import React, { useEffect, useState } from 'react';
import { LeetcodeAPI } from '../services/leetcodeAPI';

// Add this function to format problem data as plaintext
const formatProblemAsPlainText = (problemData: ProblemData): string => {
  if (!problemData) return '';
  
  let text = '';
  
  // Basic problem info
  text += `Problem #${problemData.questionFrontendId}: ${problemData.title}\n`;
  text += `Difficulty: ${problemData.difficulty}\n`;
  text += `Tags: ${problemData.topicTags.map(tag => tag.name).join(', ')}\n\n`;
  
  // Description
  if (problemData.isPremium) {
    text += "Description: This is a premium problem that requires a LeetCode subscription.\n\n";
  } else if (problemData.parsedContent) {
    // Strip HTML tags from description
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = problemData.parsedContent.description;
    text += `Description: ${tempDiv.textContent}\n\n`;
    
    // Examples
    if (problemData.parsedContent.examples && problemData.parsedContent.examples.length > 0) {
      text += "Examples:\n";
      problemData.parsedContent.examples.forEach((example, index) => {
        text += `Example ${index + 1}:\n`;
        text += `Input: ${example.input}\n`;
        text += `Output: ${example.output}\n`;
        if (example.explanation) {
          text += `Explanation: ${example.explanation}\n`;
        }
        text += "\n";
      });
    }
    
    // Constraints
    if (problemData.parsedContent.constraints) {
      text += "Constraints:\n";
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = problemData.parsedContent.constraints;
      const constraints = tempDiv.textContent?.trim() || '';
      text += `${constraints}\n\n`;
    }
    
    // Follow-up
    if (problemData.parsedContent.followUp) {
      text += `Follow-up: ${problemData.parsedContent.followUp}\n\n`;
    }
  } else {
    // Fallback if parsedContent is not available
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = problemData.content;
    text += `Description: ${tempDiv.textContent}\n\n`;
  }
  
  // User code if available
  if (problemData.userCode) {
    text += "User Code:\n```\n";
    text += problemData.userCode;
    text += "\n```\n\n";
  }
  
  // Test results if available
  if (problemData.testResult) {
    text += "Test Results:\n";
    text += `Status: ${problemData.testResult.status}\n`;
    if (problemData.testResult.details) {
      if (problemData.testResult.details.runtime) {
        text += `Runtime: ${problemData.testResult.details.runtime}\n`;
      }
      if (problemData.testResult.details.memory) {
        text += `Memory: ${problemData.testResult.details.memory}\n`;
      }
    }
    text += "\n";
  }
  
  return text;
};

// Collapsible component for sections
const Collapsible: React.FC<{ 
  title: string; 
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}> = ({ title, children, defaultOpen = false, className = '' }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className={`collapsible-section ${className}`}>
      <div 
        className={`collapsible-header ${isOpen ? 'open' : 'closed'}`} 
        onClick={() => setIsOpen(!isOpen)}
      >
        <h3>{title}</h3>
        <span className="collapsible-icon">▼</span>
      </div>
      {isOpen && <div className="collapsible-content">{children}</div>}
    </div>
  );
};

interface SimilarQuestion {
  title: string;
  titleSlug: string;
  difficulty: string;
}

interface ProblemData {
  questionId: string;
  questionFrontendId: string;
  title: string;
  content: string;
  difficulty: string;
  topicTags: { name: string }[];
  codeSnippets: {
    lang: string;
    langSlug: string;
    code: string;
  }[];
  solution?: {
    content: string;
  };
  userCode?: string | null;
  parsedContent?: {
    description: string;
    examples: { input: string; output: string; explanation?: string }[];
    constraints: string;
    followUp?: string;
  };
  timestamp: number;
  isPremium?: boolean;
  userIsPremium?: boolean;
  testResult?: {
    status: string;
    success: boolean;
    details?: {
      runtime: string | null;
      memory: string | null;
    };
  } | null;
  similarQuestions?: string;
  parsedSimilarQuestions?: SimilarQuestion[];
}

const LeetcodeScraper: React.FC<{ onScrapedData?: (data: string) => void }> = ({ onScrapedData }) => {
  const [titleSlug, setTitleSlug] = useState<string>('');
  const [problemData, setProblemData] = useState<ProblemData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // On component mount, retrieve saved data from storage or optionally clear cache
  useEffect(() => {
    // Retrieve data from storage
    chrome.storage.local.get('leetcodeData', (result) => {
      if (result.leetcodeData) {
        // Check if data is expired (more than 10 minutes old)
        const isDataExpired = !result.leetcodeData.timestamp || 
          (Date.now() - result.leetcodeData.timestamp > 10 * 60 * 1000);
        
        if (isDataExpired) {
          // Data has expired, clear cache
          chrome.storage.local.remove('leetcodeData');
          console.log('Cached data has expired, cleared storage');
        } else {
          // Data is still valid, use it
          setProblemData(result.leetcodeData);
        }
      }
    });

    // Listen for storage changes
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === 'local' && changes.leetcodeData) {
        const newData = changes.leetcodeData.newValue;
        if (newData) {
          setProblemData(newData);
        } else {
          setProblemData(null);
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  // Add an effect to format and send data to parent whenever problemData changes
  useEffect(() => {
    if (problemData && onScrapedData) {
      const formattedData = formatProblemAsPlainText(problemData);
      onScrapedData(formattedData);
    }
  }, [problemData, onScrapedData]);

  // Check if content script is loaded and inject it into the page
  const ensureContentScriptLoaded = async (tabId: number): Promise<boolean> => {
    return new Promise((resolve) => {
      try {
        // First try to send a simple test message
        chrome.tabs.sendMessage(tabId, { action: 'ping' }, (response) => {
          // Check if there is a response and no errors
          if (chrome.runtime.lastError) {
            console.log('Content script not loaded, attempting to inject...', chrome.runtime.lastError);
            
            // If content script is not loaded, manually inject it
            try {
              chrome.scripting.executeScript(
                {
                  target: { tabId },
                  files: ['contentScript.js']
                },
                () => {
                  if (chrome.runtime.lastError) {
                    console.error('Failed to inject content script:', chrome.runtime.lastError);
                    resolve(false);
                    return;
                  }
                  
                  // Wait for script to load
                  setTimeout(() => {
                    console.log('Content script injected, waiting for initialization');
                    resolve(true);
                  }, 1000); // Give the script some time to initialize
                }
              );
            } catch (err) {
              console.error('Error executing script:', err);
              resolve(false);
            }
            return;
          }
          
          if (response && response.status === 'pong') {
            console.log('Content script is already loaded');
            resolve(true);
            return;
          }
          
          resolve(false);
        });
      } catch (err) {
        console.error('Error checking content script:', err);
        resolve(false);
      }
    });
  };

  // Modify scrapeCurrentPage function to ensure the content script is loaded before sending messages
  const scrapeCurrentPage = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Clear existing data first
      setProblemData(null);
      chrome.storage.local.remove('leetcodeData', () => {
        console.log('Cache cleared before fetching fresh data');
      });

      // Get the current active tab
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        const currentTab = tabs[0];
        
        if (!currentTab.url || !currentTab.id || 
            (!currentTab.url.includes('leetcode.com/problems/') && 
             !currentTab.url.includes('leetcode.cn/problems/'))) {
          setError('Please use this extension on a LeetCode problem page');
          setIsLoading(false);
          return;
        }

        // Save tabId as a valid number
        const tabId = currentTab.id;

        // Ensure the content script is loaded
        const scriptLoaded = await ensureContentScriptLoaded(tabId);
        if (!scriptLoaded) {
          setError('Failed to load content script, please try refreshing the page');
          setIsLoading(false);
          return;
        }

        // Try extracting titleSlug directly from the URL
        const titleSlugMatch = currentTab.url.match(/\/problems\/([^/]+)/);
        const titleSlug = titleSlugMatch ? titleSlugMatch[1] : null;

        if (!titleSlug) {
          setError('Failed to extract problem identifier from URL');
          setIsLoading(false);
          return;
        }

        // Directly fetch problem data
        try {
          // Use a direct GraphQL request to fetch problem details instead of using a background script
          const problemData = await fetchProblemDataDirectly(titleSlug);
          
          if (!problemData) {
            setError('Failed to fetch problem details');
            setIsLoading(false);
            return;
          }
          
          // Parse problem content
          if (problemData.content) {
            problemData.parsedContent = parseProblemContent(problemData.content);
          }
          
          // Attempt to fetch user code and test results
          chrome.tabs.sendMessage(tabId, { action: 'scrapeLeetcodeData' }, (contentData) => {
            console.log('Received data from content script type:', typeof contentData, contentData ? 'contentData is not empty' : 'contentData is empty');
            
            // Handle case when contentData is a Promise
            if (contentData && typeof contentData === 'object' && 'then' in contentData) {
              console.log('Detected Promise-like contentData, attempting to resolve');
              (contentData as Promise<any>).then((resolvedData: any) => {
                handleContentData(resolvedData);
              }).catch((err: Error) => {
                console.error('Promise resolution error:', err);
                handleContentData(null);
              });
              return;
            }
            
            // Handle case when contentData is a regular object
            handleContentData(contentData);
            
            // Function to process data from content script
            function handleContentData(data: any) {
              if (chrome.runtime.lastError) {
                console.warn('Error fetching page data:', chrome.runtime.lastError.message);
                // Even if page data cannot be fetched, we can still display problem information
                const completeData = {
                  ...problemData,
                  userCode: null,
                  testResult: null,
                  timestamp: Date.now() // Add timestamp to ensure data is always fresh
                };
                
                chrome.storage.local.set({ leetcodeData: completeData }, () => {
                  setProblemData(completeData);
                  setIsLoading(false);
                });
                return;
              }
              
              // Extract user code and test result
              const userCode = data?.userCode || null;
              console.log('User code received from content script:', userCode ? `Length: ${userCode.length}` : 'No user code');
              if (userCode) {
                console.log('First 100 chars of user code:', userCode.substring(0, 100));
              }
              
              const testResult = data?.testResult || null;
              
              // Merge available data
              const completeData = {
                ...problemData,
                userCode,
                testResult,
                timestamp: Date.now() // Add timestamp to ensure data is always fresh
              };
  
              console.log('Complete data to save to storage:', JSON.stringify({
                hasUserCode: !!completeData.userCode,
                userCodeLength: completeData.userCode ? completeData.userCode.length : 0,
                hasTestResult: !!completeData.testResult,
              }));
  
              // Save to storage
              chrome.storage.local.set({ leetcodeData: completeData }, () => {
                console.log('Data saved to storage, updating state');
                setProblemData(completeData);
                setIsLoading(false);
              });
            }
          });
        } catch (err) {
          setError(`Error processing data: ${err instanceof Error ? err.message : String(err)}`);
          setIsLoading(false);
        }
      });
    } catch (err) {
      setError(`An error occurred: ${err instanceof Error ? err.message : String(err)}`);
      setIsLoading(false);
    }
  };
  
  // Function to fetch problem details directly from LeetCode API
  const fetchProblemDataDirectly = async (titleSlug: string) => {
    // User status query
    const USER_STATUS_QUERY = `
      query globalData {
        userStatus {
          userId
          isSignedIn
          isMockUser
          isPremium
          isVerified
          username
          avatar
          isAdmin
          isSuperuser
          permissions
          isTranslator
          activeSessionId
          checkedInToday
          notificationStatus {
            lastModified
            numUnread
          }
        }
      }
    `;
    
    const PROBLEM_QUERY = `
      query questionData($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          questionId
          questionFrontendId
          title
          content
          difficulty
          isPaidOnly
          topicTags {
            name
          }
          codeSnippets {
            lang
            langSlug
            code
          }
          solution {
            content
          }
          similarQuestions
        }
      }
    `;
    
    try {
      // First get user status
      const userStatusResponse = await fetch('https://leetcode.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'chrome-extension://'+chrome.runtime.id,
          'Referer': 'https://leetcode.com/',
          'Accept': 'application/json',
          'User-Agent': navigator.userAgent
        },
        credentials: 'include', // Include cookies to check login status
        body: JSON.stringify({
          query: USER_STATUS_QUERY
        }),
      });
      
      let isPremiumUser = false;
      if (userStatusResponse.ok) {
        const userData = await userStatusResponse.json();
        isPremiumUser = userData?.data?.userStatus?.isPremium === true;
        console.log('User premium status:', isPremiumUser);
      }

      // Then get problem data
      const response = await fetch('https://leetcode.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'chrome-extension://'+chrome.runtime.id,
          'Referer': 'https://leetcode.com/',
          'Accept': 'application/json',
          'User-Agent': navigator.userAgent
        },
        credentials: 'omit', // Don't send cookies, avoid cross-domain issues
        body: JSON.stringify({
          query: PROBLEM_QUERY,
          variables: { titleSlug },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Check if problem is premium-only
      if (data?.data?.question?.isPaidOnly === true && !isPremiumUser) {
        console.log('Premium question detected, user is not premium member');
        
        // Create a special data object indicating this is a premium problem
        return {
          questionId: data.data.question.questionId || '',
          questionFrontendId: data.data.question.questionFrontendId || '',
          title: data.data.question.title || 'Premium Question',
          content: '<div class="premium-question-notice">To view this question, you need to subscribe to LeetCode Premium.</div>',
          difficulty: data.data.question.difficulty || '',
          topicTags: data.data.question.topicTags || [],
          codeSnippets: data.data.question.codeSnippets || [],
          isPremium: true,
          userIsPremium: isPremiumUser,
          similarQuestions: data.data.question.similarQuestions || ''
        };
      }
      
      // Apply additional security checks for solution content if it exists
      if (data?.data?.question?.solution?.content) {
        // Remove iframe content directly from the original data
        data.data.question.solution.content = data.data.question.solution.content
          .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
          .replace(/<div[^>]*class="video-container"[^>]*>[\s\S]*?<\/div>/gi, '');
      }
      
      // Parse similar questions if available
      let parsedSimilarQuestions = undefined;
      if (data?.data?.question?.similarQuestions) {
        parsedSimilarQuestions = parseSimilarQuestions(data.data.question.similarQuestions);
      }
      
      // Return data along with user premium status
      return {
        ...data.data.question,
        userIsPremium: isPremiumUser,
        parsedSimilarQuestions
      };
    } catch (error) {
      console.error('Error fetching problem data:', error);
      return null;
    }
  };

  // Function to parse similar questions JSON string
  function parseSimilarQuestions(similarQuestionsStr: string): SimilarQuestion[] {
    try {
      if (!similarQuestionsStr) return [];
      
      const questions = JSON.parse(similarQuestionsStr);
      if (!Array.isArray(questions)) return [];
      
      return questions.map((q: any) => ({
        title: q.title || '',
        titleSlug: q.titleSlug || '',
        difficulty: q.difficulty || ''
      }));
    } catch (error) {
      console.error('Error parsing similar questions:', error);
      return [];
    }
  }

  useEffect(() => {
    const handleResize = () => {
      console.log('Window size:', window.innerWidth, window.innerHeight);
      console.log('Popup size:', document.querySelector('.leetcode-scraper')?.getBoundingClientRect());
    };
    
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Parse problem content, separate into different parts
  function parseProblemContent(content: string): {
    description: string;
    examples: { input: string; output: string; explanation?: string }[];
    constraints: string;
    followUp?: string;
  } {
    // Create a temporary DIV to parse HTML content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;

    // Extract description part - all content before Example
    let description = '';
    const descriptionNodes = [];
    let currentNode = tempDiv.firstChild;
    
    while (currentNode) {
      if (currentNode.textContent?.includes('Example 1:') || 
          currentNode.textContent?.includes('示例 1:')) {
        break;
      }
      
      // Only copy nodes, don't add to document
      descriptionNodes.push(currentNode.cloneNode(true));
      currentNode = currentNode.nextSibling;
    }
    
    // Create a new div to store description nodes
    const descDiv = document.createElement('div');
    descriptionNodes.forEach(node => descDiv.appendChild(node));
    description = descDiv.innerHTML;

    // Extract examples with a unified approach
    const examples = [];
    
    // Unified example extraction function, tries from the most accurate to the most general method
    const extractExamples = (): { input: string; output: string; explanation?: string }[] => {
      const result: { input: string; output: string; explanation?: string }[] = [];
      
      // Try method 1: Extract directly from pre tags
      const tryPreTags = () => {
        const preElements = tempDiv.querySelectorAll('pre');
        for (const preEl of Array.from(preElements)) {
          const text = preEl.textContent || '';
          
          const inputMatch = text.match(/Input:?\s*(.*?)(?=Output:|$)/i);
          const outputMatch = text.match(/Output:?\s*(.*?)(?=Explanation:|$)/i);
          const explanationMatch = text.match(/Explanation:?\s*(.*?)$/i);
          
          if (inputMatch && outputMatch) {
            result.push({
              input: inputMatch[1].trim(),
              output: outputMatch[1].trim(),
              explanation: explanationMatch ? explanationMatch[1].trim() : undefined
            });
          }
        }
      };
      
      // Try method 2: Use HTML structure to find example sections
      const tryStructuredExamples = () => {
        // Find all elements whose text is "Example X:"
        const exampleTitles = Array.from(tempDiv.querySelectorAll('*')).filter(
          el => el.textContent?.match(/Example\s+\d+:/) || el.textContent?.includes('Example:')
        );
        
        for (const title of exampleTitles) {
          let exampleContent = '';
          let nextElement = title.nextElementSibling;
          
          // Collect until the next example or constraints section
          while (nextElement && 
                !nextElement.textContent?.includes('Example') && 
                !nextElement.textContent?.includes('Constraints')) {
            
            if (nextElement.tagName === 'PRE') {
              exampleContent += nextElement.textContent || '';
            }
            nextElement = nextElement.nextElementSibling;
          }
          
          if (exampleContent) {
            const inputMatch = exampleContent.match(/Input:?\s*(.*?)(?=Output:|$)/i);
            const outputMatch = exampleContent.match(/Output:?\s*(.*?)(?=Explanation:|$)/i);
            const explanationMatch = exampleContent.match(/Explanation:?\s*(.*?)$/i);
            
            if (inputMatch && outputMatch) {
              result.push({
                input: inputMatch[1].trim(),
                output: outputMatch[1].trim(),
                explanation: explanationMatch ? explanationMatch[1].trim() : undefined
              });
            }
          }
        }
      };
      
      // Try method 3: Use text analysis
      const tryTextAnalysis = () => {
        const fullText = tempDiv.textContent || '';
        const exampleSections = fullText.split(/Example\s+\d+:/);
        
        if (exampleSections.length > 1) {
          for (let i = 1; i < exampleSections.length; i++) {
            const section = exampleSections[i];
            
            const inputIndex = section.indexOf('Input:');
            const outputIndex = section.indexOf('Output:');
            const explanationIndex = section.indexOf('Explanation:');
            
            // 下一个边界
            const nextExampleIndex = section.indexOf('Example ', 1);
            const constraintsIndex = section.indexOf('Constraints:');
            
            if (inputIndex !== -1 && outputIndex !== -1) {
              // 提取内容
              let input = '';
              let output = '';
              let explanation = '';
              
              input = section.substring(inputIndex + 'Input:'.length, outputIndex).trim();
              
              const endOfOutput = explanationIndex !== -1 ? explanationIndex : 
                                 nextExampleIndex !== -1 ? nextExampleIndex : 
                                 constraintsIndex !== -1 ? constraintsIndex : 
                                 section.length;
              output = section.substring(outputIndex + 'Output:'.length, endOfOutput).trim();
              
              if (explanationIndex !== -1) {
                const endOfExplanation = nextExampleIndex !== -1 ? nextExampleIndex : 
                                        constraintsIndex !== -1 ? constraintsIndex : 
                                        section.length;
                explanation = section.substring(explanationIndex + 'Explanation:'.length, endOfExplanation).trim();
              }
              
              result.push({
                input: input.replace(/\n+/g, ' ').trim(),
                output: output.replace(/\n+/g, ' ').trim(),
                explanation: explanation ? explanation.replace(/\n+/g, ' ').trim() : undefined
              });
            }
          }
        }
      };
      
      // Try each method in turn, return as soon as examples are found
      tryPreTags();
      if (result.length > 0) return result;
      
      tryStructuredExamples();
      if (result.length > 0) return result;
      
      tryTextAnalysis();
      return result;
    };
    
    // Extract and store examples
    const extractedExamples = extractExamples();
    if (extractedExamples.length > 0) {
      examples.push(...extractedExamples);
    } else {
      console.log('No examples found using standard extraction methods');
    }

    // Extract constraints
    let constraints = '';
    let constraintsStarted = false;
    let followUp = '';
    let followUpStarted = false;
    
    // create a helper function to extract html content
    const extractHtmlContent = (node: Node, sectionName: string): string => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        // for ul, ol, p
        if (node.nodeName === 'UL' || node.nodeName === 'OL' || node.nodeName === 'P') {
          return (node as Element).outerHTML;
        } else {
          const content = (node as Element).innerHTML;
          // Remove section header and format
          let formattedContent = content.replace(new RegExp(`${sectionName}:?`, 'i'), '').trim();
          // Ensure space before math symbols
          formattedContent = formattedContent.replace(/(\S)O\(/g, '$1 O(');
          return formattedContent;
        }
      } else if (node.nodeType === Node.TEXT_NODE && node.textContent) {
        // Remove section header and format
        let formattedContent = node.textContent.replace(new RegExp(`${sectionName}:?`, 'i'), '').trim();
        // Ensure space before math symbols
        formattedContent = formattedContent.replace(/(\S)O\(/g, '$1 O(');
        return formattedContent;
      }
      return '';
    };
    
    // Helper to format math content
    const formatMathContent = (content: string): string => {
      if (!content) return content;
      
      // Remove redundant colons
      let formatted = content.replace(/:\s*:/g, ':');
      
      // Remove leading colons (ensure colon is removed)
      formatted = formatted.replace(/^:\s*/g, '');  // Remove leading colon
      
      // Ensure space before math symbols
      formatted = formatted.replace(/(\S)O\(/g, '$1 O(');
      
      // Fix spacing between "less than" and "O(n²)"
      formatted = formatted.replace(/less than(\s*)O\(/gi, 'less than O(');
      formatted = formatted.replace(/less\s+thanO\(/gi, 'less than O(');
      
      // Other common math expression fixes
      formatted = formatted.replace(/≤(\S)/g, '≤ $1');
      formatted = formatted.replace(/≥(\S)/g, '≥ $1');
      
      return formatted;
    };
    
    // More efficiently extract and format node content
    const extractSectionContent = (node: Node, sectionType: 'constraints' | 'followup'): string => {
      const sectionName = sectionType === 'constraints' ? 'Constraints' : 'Follow-up|Follow up';
      let content = '';
      
      if (node.nodeType === Node.ELEMENT_NODE) {
        // For UL/OL/P nodes, keep full HTML
        if (node.nodeName === 'UL' || node.nodeName === 'OL' || node.nodeName === 'P') {
          content = (node as Element).outerHTML;
        } else {
          // For other nodes, get inner HTML
          content = (node as Element).innerHTML;
          
          // Remove header text
          if (sectionType === 'followup') {
            content = content.replace(/Follow-up:|Follow up:|进阶:/gi, '').trim();
          } else {
            content = content.replace(/Constraints:|限制:/gi, '').trim();
          }
        }
      } else if (node.nodeType === Node.TEXT_NODE && node.textContent) {
        // For text nodes
        content = node.textContent;
        
        // Remove header text
        if (sectionType === 'followup') {
          content = content.replace(/Follow-up:|Follow up:|进阶:/gi, '').trim();
        } else {
          content = content.replace(/Constraints:|限制:/gi, '').trim();
        }
      }
      
      // Apply formatting, ensure correct display
      return content ? formatMathContent(content) : '';
    };
    
    // Look for constraints and follow-up sections
    for (const node of Array.from(tempDiv.childNodes)) {
      const text = node.textContent || '';
      
      // Check if it's the start of constraints section
      if (text.includes('Constraints:') || text.includes('限制:')) {
        constraintsStarted = true;
        followUpStarted = false;
        // Use common function to handle content
        const content = extractSectionContent(node, 'constraints');
        if (content) constraints += content;
        continue;
      }
      
      // Check if it's the start of follow-up section
      if (text.includes('Follow-up:') || text.includes('Follow up:') ) {
        constraintsStarted = false;
        followUpStarted = true;
        // Use common function to handle content
        const content = extractSectionContent(node, 'followup');
        if (content) followUp += content;
        continue;
      }
      
      // Use common function to handle ongoing extracted section
      if (constraintsStarted) {
        const content = extractSectionContent(node, 'constraints');
        if (content) constraints += content;
      }
      
      if (followUpStarted) {
        const content = extractSectionContent(node, 'followup');
        if (content) followUp += content;
      }
    }

    // Wrap content to ensure it's valid HTML
    if (constraints && !constraints.startsWith('<')) {
      constraints = `<div>${constraints}</div>`;
    }
    
    if (followUp && !followUp.startsWith('<')) {
      followUp = `<div>${followUp}</div>`;
    }
    
    // Final formatting for the whole content
    if (followUp) {
      // Replace redundant colons with spaces
      followUp = followUp.replace(/(^|>):\s*/g, '$1');
      // Ensure space between "less than" and "O(n2)"
      followUp = followUp.replace(/less than(\s*)O\(/gi, 'less than O(');
      followUp = followUp.replace(/less\s+thanO\(/gi, 'less than O(');
    }

    // Debug output
    console.log("Parsed examples:", examples);
    console.log("Constraints:", constraints ? "Found" : "Not found");
    console.log("Follow-up:", followUp ? "Found" : "Not found");
    
    return {
      description,
      examples,
      constraints,
      followUp: followUp || undefined
    };
  }

  // Format example data
  function formatExampleData(data: string): string {
    if (!data) return '';
    
    try {
      // Handle common LeetCode formats
      // Example: nums = [2,7,11,15], target = 9
      if (data.includes('=')) {
        // Special handling for arrays
        let formattedData = data;
        
        // Find all array formats [x\ny\nz] and replace with [x,y,z]
        const arrayRegex = /\[\s*(\d+|\w+)(\s*\n\s*(\d+|\w+))*\s*\]/g;
        const matches = data.match(arrayRegex);
        
        if (matches) {
          for (const match of matches) {
            const cleanArray = match.replace(/\[\s*/, '[')
                                 .replace(/\s*\]/, ']')
                                 .replace(/\s+/g, ',');
            formattedData = formattedData.replace(match, cleanArray);
          }
        }
        
        // Process equals sign and middle parts
        formattedData = formattedData.replace(/(\S+)\s*=\s*/, '$1 = ');
        
        // Handle arrays with underscores
        formattedData = formattedData.replace(/\[\s*([^,]*?_[^,]*?)(?:,|\])/g, '[$1]');
        
        // Keep comma-separated format, but don't break lines
        return formattedData.replace(/\n+/g, ' ').trim();
      }
      
      // Try to parse JSON arrays or objects
      if ((data.startsWith('[') && data.endsWith(']')) || 
          (data.startsWith('{') && data.endsWith('}'))) {
        
        // Clean up line breaks in data
        let cleanData = data.replace(/\n+/g, ',').replace(/,+/g, ',').replace(/\[\s*,/g, '[').replace(/,\s*\]/g, ']');
        
        // Try to parse and reformat as a single line
        try {
          const parsed = JSON.parse(cleanData);
          // For simple arrays, use single-line format
          if (Array.isArray(parsed) && parsed.length <= 10) {
            return JSON.stringify(parsed);
          }
          // For more complex data, use multi-line format
          return JSON.stringify(parsed, null, 2);
        } catch (e) {
          // If JSON parsing fails, try to fix common issues
          // Example multi-line array: [2\n7\n11\n15]
          if (data.match(/\[\s*(\d+|\w+)(\s*\n\s*(\d+|\w+))+\s*\]/)) {
            const cleanedData = data.replace(/\[\s*/, '[')
                                    .replace(/\s*\]/, ']')
                                    .replace(/\s+/g, ',');
            try {
              const parsed = JSON.parse(cleanedData);
              return JSON.stringify(parsed);
            } catch (e2) {
              // Return cleaned data if parsing fails
              return cleanedData;
            }
          }
        }
      }
      
      // Process multi-line data, ensure compact display
      return data.replace(/\n+/g, ' ').trim();
    } catch (e) {
      // If any error occurs, return original data but remove excess line breaks
      return data.replace(/\n+/g, ' ').trim();
    }
  }

  // Format solution content
  function formatSolution(content: string): string {
    if (!content) return '';
    
    try {
      // Create a general formatting function
      const applyContentProcessing = (text: string, patterns: RegExp[], replacement: string): string => {
        let result = text;
        for (const pattern of patterns) {
          if (pattern.test(result)) {
            result = result.replace(pattern, replacement);
          }
        }
        return result;
      };
      
      // Remove extra content and clean up format
      const cleanupContent = (text: string): string => {
        // Basic cleanup
        let result = text.replace(/\[TOC\]/g, '')
                        .replace(/\r\n/g, '\n')
                        .replace(/---/g, '')
                        .replace(/##(?!\s)/g, '')
                        .replace(/\*\*\*+/g, '');
        
        // Remove video section
        result = applyContentProcessing(
          result,
          [
            /## Video Solution[\s\S]*?(?=## Solution|## Solution Article|## Overview|## Approach)/i,
            /## Official Solution[\s\S]*?(?=## Solution Article|## Overview|## Approach)/i,
            /## Solution Video[\s\S]*?(?=## Solution|## Solution Article|## Overview|## Approach)/i
          ],
          '## Video\n\nBecause of privacy settings, video content cannot be displayed here.\n\n'
        );
        
        // Remove implementation section
        const implementationPatterns = [
          /(## Implementation[\s\S]*?)(?=## |$)/i,
          /(### Implementation[\s\S]*?)(?=### |## |$)/i,
          /(# Implementation[\s\S]*?)(?=# |$)/i,
          /(?:# |## |### )Implementation.*?(?=(?:# |## |### )|$)/gi,
          /(?:# |## |### )Code[\s\S]*?(?=(?:# |## |### )|$)/gi,
          /(?:# |## |### )Java[\s\S]*?(?=(?:# |## |### )|$)/gi,
          /(?:# |## |### )Python[\s\S]*?(?=(?:# |## |### )|$)/gi,
          /(?:# |## |### )C\+\+[\s\S]*?(?=(?:# |## |### )|$)/gi
        ];
        
        for (const pattern of implementationPatterns) {
          result = result.replace(pattern, '');
        }
        
        // Remove "refused to connect" content
        result = result.replace(/<div[^>]*>[\s\S]*?leetcode\.com refused to connect[\s\S]*?<\/div>/gi, '')
                      .replace(/leetcode\.com refused to connect\./gi, '');
        
        return result;
      };
      
      // Format HTML elements
      const formatHtmlElements = (text: string): string => {
        let result = text;
        
        // Handle images and iframes
        result = result.replace(/!\[(.*?)\][\s\S]*?\*Figure[\s\S]*?\*(?:\n+##?)?/g, 
                               '<div class="image-placeholder">Image not available in extension</div>')
                      .replace(/!\[(.*?)\]\((.*?)\)/g, 
                               '<div class="image-placeholder">Image not available in extension</div>')
                      .replace(/!\?!.*?!\?!/g, 
                               '<div class="image-placeholder">Image not available in extension</div>')
                      .replace(/<img[\s\S]*?>/g, 
                               '<div class="image-placeholder">Image not available in extension</div>')
                      .replace(/<iframe[\s\S]*?<\/iframe>/gi, 
                               '<div class="iframe-placeholder">Interactive code playground not available in extension</div>')
                      .replace(/<div[^>]*class="video-container"[^>]*>[\s\S]*?<\/div>/gi, 
                               '<div class="video-placeholder">Video content not available in extension</div>');
        
        // Handle headings and formatting
        result = result.replace(/##\s+(.*?)(?:\n|$)/g, '<h2>$1</h2>')
                      .replace(/###\s+(.*?)(?:\n|$)/g, '<h3>$1</h3>')
                      .replace(/#\s+(.*?)(?:\n|$)/g, '<h4>$1</h4>')
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/\*(Figure[\s\S]*?)\*/g, '')
                      .replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Handle math expressions
        result = result.replace(/\$\$(.*?)\$\$/g, '<code>$1</code>')
                      .replace(/\$(.*?)\$/g, '<code>$1</code>')
                      .replace(/\\le/g, '≤')
                      .replace(/\\cdot/g, '·')
                      .replace(/\\log/g, 'log')
                      .replace(/\\text\{([^}]*)\}/g, '$1');
        
        // Handle code blocks
        result = result.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
                      .replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
                        return `<pre class="code-block${lang ? ` language-${lang}` : ''}"><code>${code.trim()}</code></pre>`;
                      });
        
        // Handle lists
        result = result.replace(/^\* (.*?)$/gm, '<li>$1</li>')
                      .replace(/^- (.*?)$/gm, '<li>$1</li>')
                      .replace(/^(\d+)\. (.*?)$/gm, '<li>$1. $2</li>');
        
        // Handle paragraphs
        result = result.replace(/\n\n/g, '</p><p>');
        
        return result;
      };
            
      // Perform main formatting steps
      let formatted = cleanupContent(content);
      formatted = formatHtmlElements(formatted);
      
      // Add basic styles
      formatted = `
        <style>
          .solution-content {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .solution-content h2 { margin-top: 1.8em; margin-bottom: 0.8em; font-size: 1.4em; color: #1a1a1a; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
          .solution-content h3 { margin-top: 1.5em; margin-bottom: 0.5em; font-size: 1.2em; color: #333; }
          .solution-content h4 { margin-top: 1.2em; margin-bottom: 0.5em; font-size: 1.1em; color: #333; }
          .solution-content p { margin: 0.8em 0; line-height: 1.6; }
          .solution-content code { background-color: #f6f8fa; padding: 0.2em 0.4em; border-radius: 3px; font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace; font-size: 0.9em; }
          .solution-content .inline-code { background-color: #f0f0f0; color: #e83e8c; padding: 0.1em 0.3em; border-radius: 3px; font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace; font-size: 0.9em; white-space: nowrap; }
          .solution-content pre { background-color: #f6f8fa; padding: 1em; border-radius: 6px; overflow-x: auto; margin: 1em 0; }
          .solution-content pre code { background-color: transparent; padding: 0; font-size: 0.9em; }
          .solution-content li { margin: 0.5em 0; }
          .solution-content ul, .solution-content ol { padding-left: 2em; margin: 0.8em 0; }
          .solution-content strong { font-weight: 600; color: #000; }
          .solution-content .image-placeholder, .solution-content .code-placeholder, .solution-content .iframe-placeholder, .solution-content .video-placeholder {
            background-color: #f1f1f1;
            border: 1px dashed #ccc;
            color: #666;
            text-align: center;
            padding: 2em 1em;
            margin: 1em 0;
            border-radius: 4px;
            font-style: italic;
          }
        </style>
        <div class="solution-content"><p>${formatted}</p></div>
      `;
      
      return formatted;
    } catch (e) {
      console.error('Error formatting solution:', e);
      return content;
    }
  }

  // Add solution display component
  const SolutionDisplay: React.FC<{ content: string }> = ({ content }) => {
    const formattedContent = formatSolution(content);
    
    return (
      <div className="solution-content">
        <div dangerouslySetInnerHTML={{ __html: formattedContent }} />
      </div>
    );
  };

  // Add useEffect to automatically scrape data when component mounts
  useEffect(() => {
    // Auto-fetch data when component first loads
    scrapeCurrentPage();
  }, []); // Empty dependency array means this runs once when component mounts

  return (
    <div className="leetcode-scraper">
      <h2>LeetCode Data Scraper</h2>
      
      <div className="actions">
        {/* Always show refresh button (without conditional) */}
        <button 
          onClick={() => {
            // Force refresh to get the latest data
            chrome.storage.local.remove('leetcodeData', () => {
              console.log('Cache cleared, fetching fresh data');
              scrapeCurrentPage();
            });
          }}
          disabled={isLoading}
          title="Force refresh to get the latest data"
        >
          {isLoading ? 'Loading...' : 'Refresh Data'}
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {problemData && (
        <Collapsible title="Problem Information" className="problem-data">
          <div>
            <strong>ID:</strong> {problemData.questionFrontendId}
          </div>
          <div>
            <strong>Title:</strong> {problemData.title}
          </div>
          <div>
            <strong>Difficulty:</strong> {problemData.difficulty}
          </div>
          <div>
            <strong>Tags:</strong> {problemData.topicTags.map(tag => tag.name).join(', ')}
          </div>
          
          {problemData.isPremium ? (
            <div className="premium-content">
              <h4>Premium Content</h4>
              <div className="premium-message">
                <p>This problem requires a LeetCode Premium subscription to access.</p>
                <p>Please visit <a href={`https://leetcode.com/problems/${titleSlug}/`} target="_blank" rel="noopener noreferrer">LeetCode</a> and subscribe to Premium to view the full content.</p>
              </div>
            </div>
          ) : problemData.parsedContent ? (
            <div className="parsed-content">
              <Collapsible title="Description" className="description">
                <div dangerouslySetInnerHTML={{ __html: problemData.parsedContent.description }} />
              </Collapsible>
              
              {problemData.parsedContent.examples && problemData.parsedContent.examples.length > 0 && (
                <Collapsible title="Examples" className="examples">
                  {problemData.parsedContent.examples.map((example, index) => (
                    <div key={index} className="example">
                      <strong>Example {index + 1}:</strong>
                      <pre className="example-code">
                        <strong>Input:</strong> {formatExampleData(example.input)}
                        {'\n'}<strong>Output:</strong> {formatExampleData(example.output)}
                        {example.explanation && (
                          <>
                            {'\n\n'}<strong>Explanation:</strong>{' '}
                            <span>{example.explanation}</span>
                          </>
                        )}
                      </pre>
                    </div>
                  ))}
                </Collapsible>
              )}
              
              {problemData.parsedContent.constraints && (
                <Collapsible title="Constraints" className="constraints">
                  <div dangerouslySetInnerHTML={{ __html: problemData.parsedContent.constraints }} />
                </Collapsible>
              )}
              
              {problemData.parsedContent.followUp && (
                <Collapsible title="Follow-up" className="follow-up">
                  <div dangerouslySetInnerHTML={{ __html: problemData.parsedContent.followUp }} />
                </Collapsible>
              )}
            </div>
          ) : (
            <div className="content-preview">
              <strong>Description Preview:</strong>
              <div dangerouslySetInnerHTML={{ __html: problemData.content.substring(0, 200) + '...' }} />
            </div>
          )}

          {!problemData.isPremium && problemData.solution && problemData.solution.content && (
            <Collapsible title="Official Solution" className="solution-preview">
              <SolutionDisplay content={problemData.solution.content} />
            </Collapsible>
          )}

          {!problemData.isPremium && !problemData.solution?.content && (
            <div className="solution-premium">
              <h4>Official Solution</h4>
              {problemData.userIsPremium ? (
                <p>This problem does not have an official solution available.</p>
              ) : (
                <p>Premium subscription required to view the official solution.</p>
              )}
            </div>
          )}
        </Collapsible>
      )}

      {problemData?.userCode && (
        <Collapsible title="User Code" className="user-code">
          <div className="code-notice">
            <p>⚠️ Note: Currently only Java and Python code formatting is fully supported, other languages may display incorrectly</p>
          </div>
          <div className="code-actions">
            <button 
              onClick={() => navigator.clipboard.writeText(problemData.userCode || '')}
              className="action-button"
            >
              Copy Code
            </button>
            <button 
              onClick={() => {
                const blob = new Blob([problemData.userCode || ''], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const extension = detectLanguage(problemData.userCode || '');
                a.download = `leetcode-${problemData.questionFrontendId}-solution.${extension}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
              className="action-button"
            >
              Download Code File
            </button>
          </div>
          <div className="code-container">
            <pre className="code-display">
              <code>
                {problemData.userCode.length > 2000 
                  ? problemData.userCode.substring(0, 2000) + '...' 
                  : problemData.userCode}
              </code>
            </pre>
          </div>
        </Collapsible>
      )}

      {problemData && (
        <Collapsible title="Test Results" className="test-results">
          {problemData.testResult ? (
            <div className={`test-result-status ${problemData.testResult.success ? 'success' : 'failure'}`}>
              <strong>Status:</strong> {problemData.testResult.status}
              {problemData.testResult.details && (
                <div className="test-details">
                  {problemData.testResult.details.runtime && (
                    <div><strong>Runtime:</strong> {problemData.testResult.details.runtime}</div>
                  )}
                  {problemData.testResult.details.memory && (
                    <div><strong>Memory:</strong> {problemData.testResult.details.memory}</div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="test-result-notice">
              <p>Run your code in LeetCode to see test results here.</p>
            </div>
          )}
        </Collapsible>
      )}
    </div>
  );
};

// Detect programming language and return corresponding file extension
function detectLanguage(code: string): string {
  if (code.includes('class Solution:') || 
      code.includes('def ') && code.includes(':')) {
    return 'py';
  }
  
  if (code.includes('class Solution {') || 
      code.includes('public class')) {
    return 'java';
  }
  
  if (code.includes('#include') || 
      code.match(/int\s+main\s*\(/)) {
    return 'cpp';
  }
  
  if (code.includes('function') || 
      code.includes('const ') || 
      code.includes('let ') || 
      code.includes('var ')) {
    return 'js';
  }
  
  // Default extension
  return 'txt';
}

export default LeetcodeScraper;