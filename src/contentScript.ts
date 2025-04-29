// change to external module
export {};

/**
 * LeetCode Data Scraper Content Script
 * This script runs on LeetCode problem pages to scrape page data
 */

// Extend the Window interface to recognize monaco
declare global {
  interface Window {
    monaco: {
      editor: {
        getEditors: () => any[];
      };
    };
  }
}

// Initialization flag to avoid duplicate execution
let fetchCount = 0;
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

// Inject external script (injected.js) into the page context using extension URL
function injectExternalScript() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('injected.js');
  script.onload = () => {
    console.log('✅ External injected script loaded successfully');
    script.remove();
  };
  script.onerror = (e) => {
    console.error('❌ Failed to load external injected script:', e);
    script.remove();
  };
  (document.head || document.documentElement).appendChild(script);
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
    // Inject external script to page context to grab Monaco code and post to window
    injectExternalScript();

    Promise.resolve(scrapeLeetcodeData()).then((data: any) => {
      console.log("✅ Entire result object:", data);
      sendResponse(data);
    });
    return true;
  }
  
  return true;  // Return true to make sendResponse work asynchronously
});

// Listen for Monaco code sent from injected script
let injectedMonacoCode: string | null = null;
let injectedMonacoCodeCallback: ((code: string) => void) | null = null;

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data.type === 'FROM_PAGE_MONACO' && typeof event.data.code === 'string') {
    console.log('[Injected] Posting code back to content script');
    console.log('📥 Received code from injected script');
    injectedMonacoCode = event.data.code;

    if (injectedMonacoCodeCallback) {
      if (injectedMonacoCode) {
        injectedMonacoCodeCallback(injectedMonacoCode);
      } else {
        console.warn('No code received to pass to the callback');
      }
      injectedMonacoCodeCallback = null;
    }
  }
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

    // Get user code and test result status
    return new Promise(async (resolve) => {
      try {
        console.log('🔍 Starting to fetch user code...');
        const userCode = await getUserCode();
        console.log('🔍 User code retrieval:', userCode ? 'SUCCESS' : 'FAILED', 
                    userCode ? `Length: ${userCode.length}` : '', 
                    userCode ? `First 30 chars: ${userCode.substring(0, 30)}...` : '');
        
        // Get test result status
        const testResult = getTestResultStatus();
        
        const result = {
          titleSlug,
          currentUrl: window.location.href,
          userCode,
          testResult
        };
        
        console.log('🔍 Complete data object ready to return:', JSON.stringify(result).substring(0, 200) + '...');
        resolve(result);
      } catch (error) {
        console.error('Error getting code or test result:', error);
        resolve({ 
          titleSlug,
          currentUrl: window.location.href,
          error: `Error getting code: ${error instanceof Error ? error.message : String(error)}` 
        });
      }
    });
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
  if ((cleanedCode.includes('def ') || cleanedCode.includes('class ')) && cleanedCode.includes(':')) {
    const lines = cleanedCode.split('\n');
    const hasIndent = lines.some(line => line.startsWith(' ') || line.startsWith('\t'));
    if (hasIndent) {
      return preserveIndentation(cleanedCode);
    } else {
      return formatPythonCode(cleanedCode);
    }
  }

  // Detect Java braces
  if ((cleanedCode.includes('public class') || cleanedCode.includes('class ')) &&
      cleanedCode.includes('{') && cleanedCode.includes('}')) {
    const lines = cleanedCode.split('\n');
    const hasIndent = lines.some(line => line.startsWith(' ') || line.startsWith('\t'));
    if (hasIndent) {
      return preserveIndentation(cleanedCode);
    } else {
      return formatCStyleCode(cleanedCode);
    }
  }

  // Detect C/C++ braces
  if ((cleanedCode.includes('#include') || (cleanedCode.includes('int ') && cleanedCode.includes('{')))) {
    const lines = cleanedCode.split('\n');
    const hasIndent = lines.some(line => line.startsWith(' ') || line.startsWith('\t'));
    if (hasIndent) {
      return preserveIndentation(cleanedCode);
    } else {
      return formatCStyleCode(cleanedCode);
    }
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
  
  // If code lacks indentation structure, attempt fallback formatting
  const lines = code.split(/\r?\n/);
  const isFlatCode = lines.filter(l => l.trim()).every(l => !l.startsWith(' ') && !l.startsWith('\t'));

  if (isFlatCode) {
    // Try to add line breaks at key points to restructure the code
    code = code
      .replace(/:([ \t]*(?=def|class|if|else|elif|for|while|try|except|finally|with))/g, ':\n$1')
      .replace(/;[ \t]*/g, '\n')
      .replace(/[ \t]{4}(?=\S)/g, '\n    ');
  }

  const codeLines = code.split(/\r?\n/);
  const formattedLines = [];
  let insideBlockComment = false;
  let currentIndent = 0;

  for (let i = 0; i < codeLines.length; i++) {
    let line = codeLines[i].trim();

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
  // if (!hasProperIndentation && code.includes('def ') && code.includes(':')) {
  //   // This is a simple fallback plan, trying to rebuild code structure based on keywords
  //   return rebuildPythonCode(code);
  // }

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

function getUserCode(): Promise<string | null> {
  return new Promise((resolve) => {
    fetchCount++;
    console.log(`🧪 getUserCode attempt #${fetchCount}`);

    let resolved = false;

    // Set fallback timer
    const fallbackTimeout = setTimeout(async () => {
      if (resolved) return;
      console.warn('⚠️ Monaco injected code not received in time, using fallback scroll');
      const fallbackCode = await scrollEditorAndCapture();
      if (fallbackCode) {
        console.log('⚠️ Using fallback scroll method to get code');
        console.log('✅ Got fallback full code via scroll');
        resolved = true;
        resolve(cleanCode(fallbackCode));
      } else {
        console.warn('❌ Fallback scroll method failed to get code');
        resolved = true;
        resolve(null);
      }
    }, 2000); // wait 2 seconds for injected code first

    // ✅ Listen for injected Monaco code if it comes
    injectedMonacoCodeCallback = (code: string) => {
      if (resolved) return;
      console.log('✅ Received Monaco code via callback');
      clearTimeout(fallbackTimeout);
      resolved = true;
      resolve(cleanCode(code));
    };
  });
}

// Special function to properly format Python code
function cleanPythonCode(code: string): string {
  if (!code) return '';
  
  try {
    // First, normalize line endings
    code = code.replace(/\r\n/g, '\n');
    
    // Fix common formatting issues in Python
    const lines = code.split('\n');
    const formattedLines = [];
    let insideDocstring = false;
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      
      // Handle docstrings
      if (line.includes('"""') || line.includes("'''")) {
        const quotes = line.includes('"""') ? '"""' : "'''";
        const quoteCount = (line.match(new RegExp(quotes, 'g')) || []).length;
        
        if (quoteCount % 2 === 1) {
          insideDocstring = !insideDocstring;
        }
      }
      
      // Remove excessive spaces but preserve indentation
      const indentMatch = line.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1] : '';
      const trimmedLine = line.trim();
      
      if (trimmedLine || insideDocstring) {
        formattedLines.push(indent + trimmedLine);
      } else if (formattedLines.length > 0) {
        // Keep meaningful empty lines
        formattedLines.push('');
      }
    }
    
    // If it looks like Python but is missing class declaration at start,
    // try to reconstruct it by moving class declaration to the top
    let result = formattedLines.join('\n');
    
    if (result.includes('def ') && result.includes(':') && 
        !result.startsWith('class') && result.includes('class')) {
      
      // Extract class definition
      const classMatch = result.match(/class\s+(\w+):/);
      if (classMatch) {
        // Remove class definition from its current position
        result = result.replace(/class\s+(\w+):/, '');
        // Add it to the beginning
        result = `class ${classMatch[1]}:\n${result}`;
      }
    }
    
    console.log('Cleaned Python code:', result);
    return result;
  } catch (e) {
    console.error('Error cleaning Python code:', e);
    return code; // Return original if cleaning fails
  }
}

// Function to clean and format Java code
function cleanJavaCode(code: string): string {
  if (!code) return '';
  
  try {
    // Check if it looks like reversed code (header comments at the end)
    if (code.trimEnd().endsWith('/**')) {
      console.log('Detected reversed Java code, attempting to fix ordering');
      
      // Split into lines and reverse the order
      const lines = code.split('\n');
      lines.reverse();
      
      // Join back and clean
      code = lines.join('\n');
    }
    
    // Handle standard Java class structure for LeetCode
    const classDefinitionPattern = /class\s+Solution\s*\{/;
    const commentHeaderPattern = /\/\*\*[\s\S]*?\*\//;
    
    // Try to extract class definition and comments
    const classMatch = code.match(classDefinitionPattern);
    const commentMatch = code.match(commentHeaderPattern);
    
    if (classMatch && commentMatch) {
      // Extract the main method inside Solution class
      const methodPattern = /public\s+\w+\s+\w+\([\s\S]*?\)\s*\{[\s\S]*?\}/g;
      const methodMatches = Array.from(code.matchAll(methodPattern));
      
      if (methodMatches.length > 0) {
        // Reconstruct code in proper order
        let reconstructed = '';
        
        // First add comment header
        reconstructed += commentMatch[0] + '\n';
        
        // Then add class opening
        reconstructed += 'class Solution {\n';
        
        // Then add methods
        for (const methodMatch of methodMatches) {
          reconstructed += '    ' + methodMatch[0] + '\n';
        }
        
        // Close class
        reconstructed += '}';
        
        console.log('Reconstructed Java code');
        return reconstructed;
      }
    }
    
    // If reconstruction failed, apply general cleaning
    // Normalize line endings
    code = code.replace(/\r\n/g, '\n');
    
    // Reconstruct the code with proper indentation
    const lines = code.split('\n');
    const formattedLines = [];
    let indentLevel = 0;
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      
      // Skip empty lines
      if (!line) {
        formattedLines.push('');
        continue;
      }
      
      // Handle Java brackets for indentation
      if (line.includes('{')) indentLevel++;
      if (line.startsWith('}')) indentLevel--;
      
      // Don't indent first level (class definition and comments)
      const indent = line.startsWith('/**') || line.startsWith('*') || line.startsWith('class ') 
        ? '' 
        : '    '.repeat(Math.max(0, indentLevel - 1));
      
      formattedLines.push(indent + line);
    }
    
    return formattedLines.join('\n');
  } catch (e) {
    console.error('Error cleaning Java code:', e);
    return code; // Return original if cleaning fails
  }
}

// Function to clean and format C/C++ code
function cleanCppCode(code: string): string {
  if (!code) return '';
  
  try {
    // Normalize line endings
    code = code.replace(/\r\n/g, '\n');
    
    // Fix common formatting issues in C/C++
    const lines = code.split('\n');
    const formattedLines = [];
    
    // Track brace levels for proper indentation
    let braceLevel = 0;
    let inComment = false;
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      
      // Skip empty lines
      if (!line) {
        formattedLines.push('');
        continue;
      }
      
      // Handle multi-line comments
      if (line.includes('/*')) inComment = true;
      if (line.includes('*/')) inComment = false;
      
      // Handle preprocessor directives - they don't get indented
      if (line.startsWith('#')) {
        formattedLines.push(line);
        continue;
      }
      
      // Count braces for indentation
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;
      
      // If line starts with closing brace, decrease indent before adding
      if (line.startsWith('}')) braceLevel = Math.max(0, braceLevel - 1);
      
      // Add indentation
      const indent = '    '.repeat(braceLevel);
      formattedLines.push(indent + line);
      
      // Update brace level for next line
      braceLevel += openBraces - closeBraces;
      braceLevel = Math.max(0, braceLevel); // Prevent negative level
    }
    
    // For C++, ensure main function or class definition is properly placed
    let result = formattedLines.join('\n');
    
    // If there's a Solution class in C++, ensure it's properly structured
    if (result.includes('class Solution') && !result.trim().startsWith('#include') && !result.trim().startsWith('class Solution')) {
      // Try to move #include directives to top
      const includeMatches = result.match(/#include\s+(<|")\w+(\.\w+)?(>|")/g);
      if (includeMatches) {
        // Remove includes from current positions
        for (const include of includeMatches) {
          result = result.replace(include, '');
        }
        
        // Add includes to the top
        result = includeMatches.join('\n') + '\n\n' + result.trim();
      }
      
      // Extract Solution class
      const solutionMatch = result.match(/class\s+Solution\s*\{[\s\S]*?\};?/);
      if (solutionMatch) {
        const solutionClass = solutionMatch[0];
        
        // Remove Solution class from current position
        result = result.replace(solutionClass, '');
        
        // Add Solution class after includes, or at beginning if no includes
        result = (includeMatches ? result : solutionClass + '\n' + result.trim());
      }
    }
    
    console.log('Cleaned C/C++ code:', result);
    return result;
  } catch (e) {
    console.error('Error cleaning C/C++ code:', e);
    return code; // Return original if cleaning fails
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
  
  
  
  // Check if it contains test case format
  const testCasePatterns = [
    /Input:.*Output:/i,
    /Example\s+\d+:/i
  ];
  if (testCasePatterns.some(pattern => pattern.test(text))) return false;
  
  return false;
}

// Function to get test result status
function getTestResultStatus() {
  console.log('Attempting to get test result status...');
  
  try {
    // Look for the result status element with the specific data attribute
    const statusElement = document.querySelector('[data-e2e-locator="console-result"]');
    
    if (statusElement) {
      const status = statusElement.textContent?.trim() || '';
      console.log('Found test result status:', status);
      
      // Check if it's a success status (Accepted)
      const isSuccess = status.includes('Accepted');
      
      // Get details about runtime and memory if available
      const runtimeElement = document.querySelector('[data-e2e-locator="submission-runtime"]');
      const memoryElement = document.querySelector('[data-e2e-locator="submission-memory"]');
      
      const runtime = runtimeElement ? runtimeElement.textContent?.trim() : null;
      const memory = memoryElement ? memoryElement.textContent?.trim() : null;
      
      return {
        status,
        success: isSuccess,
        details: {
          runtime,
          memory
        }
      };
    }
    
    // If we can't find the element with the data attribute, try alternative selectors
    const alternativeSelectors = [
      '.text-xl.font-medium.text-green-s',  // For "Accepted" status with green color
      '.text-xl.font-medium.text-red-s',    // For error status with red color
      '.text-xl.font-medium',               // General status text
      '.result-container .result-state',    // Alternative result container
      '[data-cypress="SubmissionResult"]'   // Another possible data attribute
    ];
    
    for (const selector of alternativeSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const status = element.textContent?.trim() || '';
        console.log('Found test result status via alternative selector:', status);
        return {
          status,
          success: status.includes('Accepted')
        };
      }
    }
    
    console.log('No test result status found');
    return null;
  } catch (error) {
    console.error('Error getting test result status:', error);
    return null;
  }
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
async function scrollEditorAndCapture(): Promise<string | null> {
  return new Promise((resolve) => {
    const editorContainer = document.querySelector('.monaco-editor');
    if (!editorContainer) {
      console.warn('⚠️ Monaco editor container not found');
      resolve(null);
      return;
    }

    const editorContent = editorContainer.querySelector('.view-lines');
    if (!editorContent) {
      console.warn('⚠️ Monaco editor content not found');
      resolve(null);
      return;
    }

    const scrollHeight = editorContainer.scrollHeight;
    const clientHeight = editorContainer.clientHeight;
    let currentScrollTop = 0;
    let capturedCode = '';

    const scrollAndCapture = () => {
      editorContainer.scrollTop = currentScrollTop;
      const visibleCode = Array.from(editorContent.querySelectorAll('.view-line'))
        .map((line) => line.textContent?.trim() || '')
        .join('\n');
      capturedCode += visibleCode + '\n';

      if (currentScrollTop + clientHeight >= scrollHeight) {
        console.log('✅ Finished scrolling and capturing code');
        resolve(capturedCode.trim());
      } else {
        currentScrollTop += clientHeight;
        setTimeout(scrollAndCapture, 100); // Delay to allow scrolling
      }
    };

    scrollAndCapture();
  });
}
