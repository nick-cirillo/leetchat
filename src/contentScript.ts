/**
 * LeetCode Data Scraper Content Script
 * This script runs on LeetCode problem pages to scrape page data
 */

// Initialization flag to avoid duplicate execution
let initialized = false;

// Initialization function
function initialize() {
  if (initialized) return;
  initialized = true;
  
  // Tell background script we've loaded
  console.log('LeetChat Content Script loaded, ready to scrape LeetCode data');
  
  // Delay sending message to ensure extension is fully ready
  setTimeout(() => {
    try {
      chrome.runtime.sendMessage(
        { action: 'contentScriptLoaded', url: window.location.href },
        (response) => {
          // Safely check lastError
          const lastError = chrome.runtime.lastError;
          if (lastError) {
            console.warn('Error sending contentScriptLoaded message:', lastError.message);
            return;
          }
          
          console.log('Content Script load message sent, received response:', response);
        }
      );
    } catch (e) {
      console.error('Failed to send message to background:', e);
    }
  }, 200);
}

// Initialize immediately
initialize();

// Listen for messages from popup or background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content Script received message:', message);
  
  // Respond to ping message, used to detect if content script is loaded
  if (message.action === 'ping') {
    console.log('Received ping message, responding with pong');
    sendResponse({ status: 'pong' });
    return true;
  }
  
  if (message.action === 'scrapeLeetcodeData') {
    try {
      const data = scrapeLeetcodeData();
      console.log('Scraped data:', data);
      sendResponse(data);
    } catch (error) {
      console.error('Error scraping data:', error);
      sendResponse({ 
        error: `Error scraping data: ${error instanceof Error ? error.message : String(error)}` 
      });
    }
  }
  
  return true;  // Return true to make sendResponse work asynchronously
});

// Function to scrape LeetCode page data
function scrapeLeetcodeData() {
  try {
    // Check if the page is a LeetCode problem page
    if (!window.location.href.includes('leetcode.com/problems/') && 
        !window.location.href.includes('leetcode.cn/problems/')) {
      return { error: 'Current page is not a LeetCode problem page' };
    }

    // Extract the problem identifier
    const titleSlug = extractTitleSlug();
    if (!titleSlug) {
      return { error: 'Unable to get problem identifier' };
    }

    // Get user code
    const userCode = getUserCode();
    
    return {
      titleSlug,
      currentUrl: window.location.href,
      userCode
    };
  } catch (error) {
    console.error('Error scraping data:', error);
    return { 
      error: `Error scraping data: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}

// Extract problem identifier from URL
function extractTitleSlug(): string | null {
  const match = window.location.pathname.match(/\/problems\/([^/]+)/);
  return match ? match[1] : null;
}

// Clean code, remove special characters and formatting issues
function cleanCode(code: string): string {
  if (!code) return '';
  
  // Remove zero-width characters, special spaces, and other invisible characters
  const cleanedCode = code
    // Remove zero-width space and zero-width joiner
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Remove special middle dot character (·)
    .replace(/[·\u00B7]/g, '')
    // Replace non-standard spaces with normal spaces
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    // General non-printable control character cleanup
    .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Try to automatically detect and format code based on language features
  // Detect Python indentation
  if (cleanedCode.includes('def ') || cleanedCode.includes('class ') && cleanedCode.includes(':')) {
    return formatPythonCode(cleanedCode);
  }
  
  // Detect Java/C++ braces
  if ((cleanedCode.includes('public class') || cleanedCode.includes('class ')) && 
      cleanedCode.includes('{') && cleanedCode.includes('}')) {
    return formatCStyleCode(cleanedCode);
  }
  
  // Default handling: simple cleanup and maintain original indentation
  return preserveIndentation(cleanedCode);
}

// Preserve code indentation structure
function preserveIndentation(code: string): string {
  const lines = code.split(/\r?\n/);
  const processedLines = [];
  
  for (const line of lines) {
    // Calculate number of leading spaces
    const leadingSpaces = line.match(/^\s*/)?.[0].length || 0;
    // Clean line content and maintain indentation
    const cleanedLine = line.trim();
    
    if (cleanedLine) {
      processedLines.push(' '.repeat(leadingSpaces) + cleanedLine);
    } else if (lines.length > 1) {
      // Keep empty lines (if not a single line of code)
      processedLines.push('');
    }
  }
  
  return processedLines.join('\n');
}

// Format Python code
function formatPythonCode(code: string): string {
  // First clean special characters from the code
  code = code
    // Remove leading and trailing spaces
    .trim()
    // Remove zero-width characters, special spaces, and other invisible characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Remove special middle dot character (·)
    .replace(/[·\u00B7]/g, '')
    // Replace non-standard spaces with normal spaces
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ');
  
  // Check if code is just one line, if so, it may need processing
  if (!code.includes('\n')) {
    // Try to add line breaks at key points to restructure the code
    code = code
      // Add line break after common statements
      .replace(/:([ \t]*(?=def|class|if|else|elif|for|while|try|except|finally|with))/g, ':\n$1')
      // Add line breaks at other places to avoid all code on one line
      .replace(/;[ \t]*/g, '\n')
      // Recognize code blocks by indentation
      .replace(/[ \t]{4}(?=\S)/g, '\n    ');
  }
  
  const lines = code.split(/\r?\n/);
  const formattedLines = [];
  let insideBlockComment = false;
  let currentIndent = 0;
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    
    // Skip empty lines, but keep them
    if (!line) {
      formattedLines.push('');
      continue;
    }
    
    // Detect block comments (multi-line strings might be used as docstrings)
    if (line.includes('"""') || line.includes("'''")) {
      const tripleQuotes = line.includes('"""') ? '"""' : "'''";
      // If there are opening and closing triple quotes on the same line, don't change comment state
      if ((line.startsWith(tripleQuotes) && line.endsWith(tripleQuotes)) && 
          line.indexOf(tripleQuotes, 3) === line.length - 3) {
        // This is a complete multi-line string on a single line
        formattedLines.push(' '.repeat(currentIndent) + line);
        continue;
      }
      // Otherwise toggle comment state
      insideBlockComment = !insideBlockComment;
    }
    
    // Handle indentation - very important for Python
    if (!insideBlockComment) {
      // Keywords that reduce indentation
      if (line.match(/^(else|elif|except|finally):/)) {
        currentIndent = Math.max(0, currentIndent - 4);
      }
      
      // Add appropriate indentation
      formattedLines.push(' '.repeat(currentIndent) + line);
      
      // Keywords that increase indentation (lines ending with colon, like if, for, etc.)
      if (line.endsWith(':')) {
        currentIndent += 4;
      }
    } else {
      // Inside block comment, maintain current indentation
      formattedLines.push(' '.repeat(currentIndent) + line);
    }
  }
  
  // Check if there's any indentation, if not, the code might be malformed
  const hasProperIndentation = formattedLines.some(line => line.startsWith('    '));
  
  // If there's no proper indentation, we might need to try other methods
  if (!hasProperIndentation && code.includes('def ') && code.includes(':')) {
    // This is a simple fallback plan, trying to rebuild code structure based on keywords
    return rebuildPythonCode(code);
  }
  
  return formattedLines.join('\n');
}

// Try to rebuild malformed Python code format
function rebuildPythonCode(code: string): string {
  // First clean all whitespace
  const cleanedCode = code.replace(/\s+/g, ' ').trim();
  
  // Initialize indent level and result array
  let indentLevel = 0;
  const resultLines = [];
  
  // Temporarily store partial code
  let currentPart = '';
  
  // Analyze code character by character
  for (let i = 0; i < cleanedCode.length; i++) {
    const char = cleanedCode[i];
    currentPart += char;
    
    // Handle indentation after colon
    if (char === ':') {
      // Add current part to result
      resultLines.push(' '.repeat(indentLevel * 4) + currentPart.trim());
      currentPart = '';
      indentLevel++;
    } 
    // Reduce indentation before certain keywords
    else if (currentPart.trim() === 'else' || 
             currentPart.trim() === 'elif' || 
             currentPart.trim() === 'except' || 
             currentPart.trim() === 'finally') {
      indentLevel = Math.max(0, indentLevel - 1);
      resultLines.push(' '.repeat(indentLevel * 4) + currentPart.trim());
      currentPart = '';
    }
    // Add line breaks at semicolons
    else if (char === ';') {
      resultLines.push(' '.repeat(indentLevel * 4) + currentPart.slice(0, -1).trim());
      currentPart = '';
    }
  }
  
  // Add final part
  if (currentPart.trim()) {
    resultLines.push(' '.repeat(indentLevel * 4) + currentPart.trim());
  }
  
  return resultLines.join('\n');
}

// Format C-style code (Java/C++, etc.)
function formatCStyleCode(code: string): string {
  // Clean code, remove extra whitespace and special characters
  let cleanedCode = code
    .replace(/\s+/g, ' ')  // Replace multiple whitespace with one space
    .trim();
  
  // Process braces and semicolons for formatting
  cleanedCode = cleanedCode
    .replace(/\{/g, ' {\n')  // Add line break after left brace
    .replace(/\}/g, '\n}')   // Add line break before right brace
    .replace(/;/g, ';\n')    // Add line break after semicolon
    .replace(/\}\s*else/g, '} else')  // Fix else formatting
    .replace(/\}\n;/g, '};') // Fix ending }; formatting
    .replace(/\{\s*\n\s*\n/g, '{\n')  // Remove extra empty lines
    .replace(/\n\s*\n\s*\}/g, '\n}'); // Remove extra empty lines
  
  // Add proper indentation
  const lines = cleanedCode.split('\n');
  let indentLevel = 0;
  const formattedLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue; // Skip empty lines
    
    // Determine if indentation should be reduced (if line starts with })
    if (line.startsWith('}')) {
      indentLevel = Math.max(0, indentLevel - 1);
    }
    
    // Add appropriate indentation
    if (line.length > 0) {
      formattedLines.push(' '.repeat(indentLevel * 4) + line);
    }
    
    // Determine if indentation should be increased (if line ends with {)
    if (line.endsWith('{')) {
      indentLevel++;
    }
  }
  
  return formattedLines.join('\n');
}

// Get user code
function getUserCode(): string | null {
  console.log('Attempting to get user code...');
  
  try {
    // Try to get from Monaco editor
    if (typeof (window as any).monaco !== 'undefined') {
      try {
        console.log('Attempting to get code from Monaco editor...');
        const editorModels = (window as any).monaco.editor.getModels();
        if (editorModels && editorModels.length > 0) {
          // Usually the code editor is the first model
          const code = editorModels[0].getValue();
          console.log('Got code from Monaco editor:', code ? code.substring(0, 50) + '...' : 'none');
          return cleanCode(code);
        }
      } catch (e) {
        console.error('Failed to get code from Monaco editor:', e);
      }
    }
    
    // Try to identify the code editing area
    // Specific selectors for LeetCode's new UI
    const codeAreaSelectors = [
      // Main editor area
      '.monaco-editor',
      // CodeMirror editor
      '.CodeMirror',
      // Code submission area
      '.code-area',
      '.code-editor',
      '[data-cy="code-editor"]',
      // Possible selectors for Chinese version
      '.editor-wrapper'
    ];
    
    // Try to find the code editing area element
    let editorElement = null;
    for (const selector of codeAreaSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        console.log(`Found code editing area: ${selector}`);
        editorElement = element;
        break;
      }
    }
    
    if (editorElement) {
      // If it's a CodeMirror editor
      if (editorElement.classList.contains('CodeMirror') || editorElement.querySelector('.CodeMirror')) {
        const cm = (editorElement as any).CodeMirror || 
                  (editorElement.querySelector('.CodeMirror') as any)?.CodeMirror;
        if (cm && typeof cm.getValue === 'function') {
          const code = cm.getValue();
          console.log('Successfully got code from CodeMirror editor');
          return cleanCode(code);
        }
      }
      
      // Look for LeetCode-specific code areas
      // Usually in LeetCode, code is in specific <div> or <textarea> elements
      const codeElements = editorElement.querySelectorAll('textarea, [role="code"], .view-lines, .ace_content');
      for (const el of Array.from(codeElements)) {
        const text = el.textContent || (el as HTMLTextAreaElement).value;
        if (text && isValidCode(text)) {
          console.log('Successfully got code from editor child element');
          return cleanCode(text);
        }
      }
      
      // If no specific elements are found, try to get the entire editor area's content
      const editorContent = editorElement.textContent;
      if (editorContent && isValidCode(editorContent)) {
        console.log('Successfully got code from editor area');
        return cleanCode(editorContent);
      }
    }
    
    // Try to find pre-submitted code blocks
    const preElements = document.querySelectorAll('pre');
    for (const pre of Array.from(preElements)) {
      // Check if it's code and not test results
      const preText = pre.textContent || '';
      // Check if it's a test case
      const isTestCase = [/Input:.*Output:/i, /Example\s+\d+:/i, /^\s*输入：.*输出：/m, /^\s*示例\s*\d+：/m]
        .some(pattern => pattern.test(preText));
      
      if (preText && isValidCode(preText) && !isTestCase) {
        console.log('Successfully got code from pre element');
        return cleanCode(preText);
      }
    }
    
    // Finally try to find all possible code in the page
    const allPossibleCodeElements = document.querySelectorAll('.CodeMirror-code, .ace_content, .monaco-editor textarea');
    for (const el of Array.from(allPossibleCodeElements)) {
      const text = el.textContent;
      // Check if it's a test case
      const isTestCase = [/Input:.*Output:/i, /Example\s+\d+:/i, /^\s*输入：.*输出：/m, /^\s*示例\s*\d+：/m]
        .some(pattern => pattern.test(text || ''));
        
      if (text && isValidCode(text) && !isTestCase) {
        console.log('Successfully got code from generic code element');
        return cleanCode(text);
      }
    }
    
    console.log('Could not get code through any method');
    return null;
  } catch (error) {
    console.error('Error getting user code:', error);
    return null;
  }
}

// Validate if text is likely valid code
function isValidCode(text: string): boolean {
  // Ignore empty string
  if (!text || text.trim().length === 0) return false;
  
  // Ignore very short text
  if (text.length < 10) return false;
  
  // If it contains HTML tags, it's probably not code
  if (/<\/?[a-z][\s\S]*>/i.test(text)) return false;
  
  // Check for programming language features
  const codeFeatures = [
    /class\s+\w+/,        // Class definition
    /function\s+\w+/,      // Function definition
    /def\s+\w+/,          // Python function
    /public\s+\w+/,        // Java/C# access modifiers
    /private\s+\w+/,
    /protected\s+\w+/,
    /if\s*\([^)]*\)/,     // if statement
    /for\s*\([^)]*\)/,    // for loop
    /while\s*\([^)]*\)/,  // while loop
    /import\s+[\w.]+/,    // import statement
    /return\s+.+;/        // return statement
  ];
  
  // If it contains code features, it's likely code
  if (codeFeatures.some(pattern => pattern.test(text))) return true;
  
  // Check for other programming features
  if (text.includes('{') && text.includes('}')) return true;  // Braces
  if (text.includes('def ') && text.includes(':')) return true;  // Python style
  if (text.includes('=>')) return true;  // Arrow functions
  if (text.match(/[a-zA-Z0-9]+\([^)]*\)/)) return true;  // Function calls
  
  // Check if it's a comment, possibly not valid code
  if (text.includes('点赞') || text.includes('关注') || 
      text.includes('谢谢') || text.includes('希望能帮到你')) {
    return false;
  }
  
  // Check if it contains test case format
  const testCasePatterns = [
    /Input:.*Output:/i,
    /Example\s+\d+:/i,
    /^\s*输入：.*输出：/m,
    /^\s*示例\s*\d+：/m
  ];
  if (testCasePatterns.some(pattern => pattern.test(text))) return false;
  
  return false;
}

// Add page load complete event listener
window.addEventListener('load', () => {
  console.log('Page load complete, LeetChat Content Script ready');
  
  // Ensure initialization again
  initialize();
  
  // Publish a custom event indicating script has loaded
  window.dispatchEvent(new CustomEvent('leetcode_scraper_ready'));
});

// Directly handle DOM load complete
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  console.log('DOM already loaded, initializing Content Script');
  initialize();
} else {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM content loaded, initializing Content Script');
    initialize();
  });
} 