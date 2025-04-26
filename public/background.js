// Background script for LeetChat extension

// GraphQL query to get problem details
const PROBLEM_QUERY = `
  query questionData($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      questionId
      questionFrontendId
      title
      content
      difficulty
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
    }
  }
`;

// Object to store tab status, recording which tabs have loaded the content script
const tabsWithContentScript = {};

// When the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  console.log('LeetChat extension installed/updated');
  
  // Create context menu item
  chrome.contextMenus.create({
    id: "scrapeLeetcode",
    title: "Scrape LeetCode Data",
    contexts: ["page"],
    documentUrlPatterns: ["*://leetcode.com/problems/*", "*://leetcode.cn/problems/*"]
  });
});

// Monitor tab updates, record status when navigating to LeetCode page
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only process fully loaded pages
  if (changeInfo.status === 'complete' && tab.url) {
    // Check if it's a LeetCode page
    if (tab.url.includes('leetcode.com/problems/') || 
        tab.url.includes('leetcode.cn/problems/')) {
      // Mark this tab as not having initialized content script
      tabsWithContentScript[tabId] = false;
    }
  }
});

// Monitor tab closure, clean up state
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId in tabsWithContentScript) {
    delete tabsWithContentScript[tabId];
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Content script loaded notification
  if (message.action === 'contentScriptLoaded') {
    if (sender.tab && sender.tab.id) {
      // Mark that the tab has loaded the content script
      tabsWithContentScript[sender.tab.id] = true;
      console.log(`Marked tab ${sender.tab.id} as having loaded content script`);
    }
    sendResponse({ status: 'acknowledged' });
  }
  
  // Handle ping check
  if (message.action === 'ping') {
    sendResponse({ status: 'pong' });
  }
  
  // Other message handling remains unchanged
  if (message.action === 'getProblemData') {
    const titleSlug = message.titleSlug;
    
    if (!titleSlug) {
      sendResponse({ success: false, error: 'Missing problem identifier' });
      return true;
    }
    
    fetchProblemData(titleSlug)
      .then(data => {
        if (!data) {
          sendResponse({ success: false, error: 'Failed to get problem data' });
          return;
        }
        sendResponse({ success: true, data });
      })
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true; // Return true for async sendResponse
  }
  
  if (message.action === 'getLeetcodeData') {
    chrome.storage.local.get('leetcodeData', (result) => {
      sendResponse(result.leetcodeData || null);
    });
    return true;
  }
  
  return true; // Return true to keep message channel open
});

// When context menu item is clicked
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "scrapeLeetcode" && tab?.id) {
    console.log('Scrape LeetCode data menu item clicked');
    
    // Check if content script is loaded
    const contentScriptLoaded = tabsWithContentScript[tab.id] === true;
    if (!contentScriptLoaded) {
      console.log(`Content script not loaded for tab ${tab.id}, attempting to inject`);
      
      // Try to inject content script
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['contentScript.js']
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('Failed to inject content script:', chrome.runtime.lastError);
          showNotification('Error', 'Failed to inject content script, please refresh the page and try again');
          return;
        }
        
        // Give the script some time to initialize
        setTimeout(() => {
          processScrapeRequest(tab);
        }, 500);
      });
    } else {
      processScrapeRequest(tab);
    }
  }
});

// Logic to process scrape request
function processScrapeRequest(tab) {
  if (!tab || !tab.id) return;
  
  // First get the titleSlug
  const url = tab.url || '';
  const match = url.match(/\/problems\/([^/]+)/);
  if (!match) {
    console.error('Unable to get problem identifier from URL');
    showNotification('Error', 'Unable to recognize LeetCode problem');
    return;
  }
  
  const titleSlug = match[1];
  
  // First try to get problem data
  fetchProblemData(titleSlug)
    .then(problemData => {
      if (!problemData) {
        throw new Error('Failed to get problem data');
      }
      
      // Send message to content script to get page data
      try {
        chrome.tabs.sendMessage(tab.id, { action: 'scrapeLeetcodeData' }, (contentData) => {
          // Safely check lastError
          const lastError = chrome.runtime.lastError;
          if (lastError) {
            console.warn('Unable to get code and test results from page:', lastError.message);
            
            // Even without contentData, we still save problem info
            const partialData = {
              ...problemData,
              userCode: null,
              testResults: null
            };
            
            // Save to storage
            chrome.storage.local.set({ leetcodeData: partialData }, () => {
              console.log('Saved partial data to storage (problem info only)');
              showNotification('LeetChat', `Scraped problem "${problemData.title}" (no user code or test results)`);
            });
            
            return;
          }
          
          // If contentData has an error
          if (contentData && contentData.error) {
            console.error('Content script returned error:', contentData.error);
            
            // Save partial data
            const partialData = {
              ...problemData,
              userCode: null,
              testResults: null
            };
            
            chrome.storage.local.set({ leetcodeData: partialData }, () => {
              console.log('Saved partial data to storage (problem info only)');
              showNotification('LeetChat', `Scraped problem "${problemData.title}" (no user code or test results)`);
            });
            
            return;
          }
          
          // Merge data
          const completeData = {
            ...problemData,
            userCode: contentData?.userCode || null,
            testResults: contentData?.testResults || null
          };
          
          // Save to storage
          chrome.storage.local.set({ leetcodeData: completeData }, () => {
            console.log('Data saved to storage');
            showNotification('LeetChat', `Successfully scraped data for problem "${problemData.title}"`);
          });
        });
      } catch (error) {
        console.error('Error sending message to content script:', error);
        
        // Save partial data
        const partialData = {
          ...problemData,
          userCode: null,
          testResults: null
        };
        
        chrome.storage.local.set({ leetcodeData: partialData }, () => {
          console.log('Saved partial data to storage (problem info only)');
          showNotification('LeetChat', `Scraped problem "${problemData.title}" (no user code or test results)`);
        });
      }
    })
    .catch(error => {
      console.error('Error getting problem data:', error);
      showNotification('Error', `Failed to get problem data: ${error.message}`);
    });
}

// Helper function to show notifications
function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'images/favicon-32x32.png',
    title: title,
    message: message
  });
}

// Get problem data from LeetCode API
async function fetchProblemData(titleSlug) {
  try {
    const response = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: PROBLEM_QUERY,
        variables: { titleSlug },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data || !data.data || !data.data.question) {
      throw new Error('Invalid data format returned by API');
    }
    
    return data.data.question;
  } catch (error) {
    console.error('Error getting problem data:', error);
    throw error;
  }
}
