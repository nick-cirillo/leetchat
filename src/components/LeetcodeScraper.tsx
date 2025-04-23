import React, { useEffect, useState } from 'react';
import { LeetcodeAPI } from '../services/leetcodeAPI';

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
}

const LeetcodeScraper: React.FC = () => {
  const [titleSlug, setTitleSlug] = useState<string>('');
  const [problemData, setProblemData] = useState<ProblemData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [exported, setExported] = useState<boolean>(false);

  // On component mount, retrieve saved data from storage or optionally clear cache
  useEffect(() => {
    // 从存储中获取数据
    chrome.storage.local.get('leetcodeData', (result) => {
      if (result.leetcodeData) {
        // 检查数据是否过期（超过10分钟）
        const isDataExpired = !result.leetcodeData.timestamp || 
          (Date.now() - result.leetcodeData.timestamp > 10 * 60 * 1000);
        
        if (isDataExpired) {
          // 数据已过期，清除缓存
          chrome.storage.local.remove('leetcodeData');
          console.log('Cached data has expired, cleared storage');
        } else {
          // 数据仍然有效，使用它
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

  // 检查内容脚本是否已加载并注入到页面
  const ensureContentScriptLoaded = async (tabId: number): Promise<boolean> => {
    return new Promise((resolve) => {
      try {
        // 首先尝试发送一个简单的测试消息
        chrome.tabs.sendMessage(tabId, { action: 'ping' }, (response) => {
          // 检查是否有响应和是否有错误
          if (chrome.runtime.lastError) {
            console.log('Content script not loaded, attempting to inject...', chrome.runtime.lastError);
            
            // 如果内容脚本未加载，手动注入
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
                  
                  // 等待脚本加载
                  setTimeout(() => {
                    console.log('Content script injected, waiting for initialization');
                    resolve(true);
                  }, 1000); // 给脚本一些初始化的时间
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

        // 清除旧数据，确保不会显示缓存内容
        setProblemData(null);
        chrome.storage.local.remove('leetcodeData');
        
        // Directly fetch problem data
        try {
          // Use a direct GraphQL request to fetch problem details instead of using a background script
          const problemData = await fetchProblemDataDirectly(titleSlug);
          
          if (!problemData) {
            setError('Failed to fetch problem details');
            setIsLoading(false);
            return;
          }
          
          // 解析问题内容
          if (problemData.content) {
            problemData.parsedContent = parseProblemContent(problemData.content);
          }
          
          // Attempt to fetch user code and test results
          chrome.tabs.sendMessage(tabId, { action: 'scrapeLeetcodeData' }, (contentData) => {
            if (chrome.runtime.lastError) {
              console.warn('Error fetching page data:', chrome.runtime.lastError.message);
              // Even if page data cannot be fetched, we can still display problem information
              const completeData = {
                ...problemData,
                userCode: null,
                timestamp: Date.now() // 添加时间戳，确保数据总是最新的
              };
              
              chrome.storage.local.set({ leetcodeData: completeData }, () => {
                setProblemData(completeData);
                setIsLoading(false);
              });
              return;
            }
            
            // If fetching page data fails, we can still display problem information
            const userCode = contentData?.userCode || null;
            
            // Merge available data
            const completeData = {
              ...problemData,
              userCode,
              timestamp: Date.now() // 添加时间戳，确保数据总是最新的
            };

            // Save to storage
            chrome.storage.local.set({ leetcodeData: completeData }, () => {
              setProblemData(completeData);
              setIsLoading(false);
            });
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
    
    try {
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
      
      // Apply additional security checks for solution content if it exists
      if (data?.data?.question?.solution?.content) {
        // Remove iframe content directly from the original data
        data.data.question.solution.content = data.data.question.solution.content
          .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
          .replace(/<div[^>]*class="video-container"[^>]*>[\s\S]*?<\/div>/gi, '');
      }
      
      return data.data.question;
    } catch (error) {
      console.error('Error fetching problem data:', error);
      return null;
    }
  };

  // Export data as a JSON file
  const exportData = () => {
    if (!problemData) return;

    const data = {
      problem: {
        id: problemData.questionFrontendId,
        title: problemData.title,
        content: problemData.content,
        difficulty: problemData.difficulty,
        tags: problemData.topicTags.map(tag => tag.name)
      },
      parsedContent: problemData.parsedContent || null,
      solution: {
        official: problemData.solution?.content 
          ? {
              raw: problemData.solution.content,
              formatted: formatSolution(problemData.solution.content)
            }
          : "Premium subscription required to view the solution",
        userCode: problemData.userCode || null
      }
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `leetcode-${problemData.questionFrontendId}-${problemData.title.replace(/\s+/g, '-').toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // 显示成功消息
    setExported(true);
    setTimeout(() => setExported(false), 3000);
  };

  // Clear saved data
  const clearData = () => {
    chrome.storage.local.remove('leetcodeData', () => {
      setProblemData(null);
    });
  };

  useEffect(() => {
    const handleResize = () => {
      console.log('Window size:', window.innerWidth, window.innerHeight);
      console.log('Popup size:', document.querySelector('.leetcode-scraper')?.getBoundingClientRect());
    };
    
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 解析题目内容，分离成不同部分
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

    // Extract examples - more complex logic to handle different formats
    const examples = [];
    
    // Method 1: Look for pre tags
    const preElements = tempDiv.querySelectorAll('pre');
    for (const preEl of Array.from(preElements)) {
      const text = preEl.textContent || '';
      
      const inputMatch = text.match(/Input:?\s*(.*?)(?=Output:|$)/i);
      const outputMatch = text.match(/Output:?\s*(.*?)(?=Explanation:|$)/i);
      const explanationMatch = text.match(/Explanation:?\s*(.*?)$/i);
      
      if (inputMatch && outputMatch) {
        examples.push({
          input: inputMatch[1].trim(),
          output: outputMatch[1].trim(),
          explanation: explanationMatch ? explanationMatch[1].trim() : undefined
        });
      }
    }

    // Method 2: If no examples found, try to find child elements of the example section
    if (examples.length === 0) {
      // Find all example sections
      const exampleTexts: string[] = [];
      const allElements = Array.from(tempDiv.querySelectorAll('*'));
      
      for (let i = 0; i < allElements.length; i++) {
        const element = allElements[i];
        const text = element.textContent || '';
        
        // Check if it's an example title
        if (text.includes('Example') && text.includes(':') && 
            (text.match(/Example\s+\d+:/) || text.includes('Example:'))) {
          
          // Find content after the example
          let exampleContent = '';
          let nextElement = element.nextElementSibling;
          
          // Collect all content until the next example or constraints
          while (nextElement && 
                 !nextElement.textContent?.includes('Example') && 
                 !nextElement.textContent?.includes('Constraints')) {
            
            if (nextElement.tagName === 'PRE') {
              exampleContent += nextElement.textContent || '';
            }
            nextElement = nextElement.nextElementSibling;
          }
          
          if (exampleContent) {
            exampleTexts.push(exampleContent);
          }
        }
      }
      
      // Process the collected example texts
      for (const exampleText of exampleTexts) {
        const inputMatch = exampleText.match(/Input:?\s*(.*?)(?=Output:|$)/i);
        const outputMatch = exampleText.match(/Output:?\s*(.*?)(?=Explanation:|$)/i);
        const explanationMatch = exampleText.match(/Explanation:?\s*(.*?)$/i);
        
        if (inputMatch && outputMatch) {
          examples.push({
            input: inputMatch[1].trim(),
            output: outputMatch[1].trim(),
            explanation: explanationMatch ? explanationMatch[1].trim() : undefined
          });
        }
      }
    }
    
    // Method 3: If still no examples found, search for keywords in paragraphs
    if (examples.length === 0) {
      console.log('Trying method 3 to extract examples');
      const htmlContent = tempDiv.innerHTML;
      
      // Use regex to extract example sections
      const exampleRegex = /<strong[^>]*>Example\s*\d+:?<\/strong>[\s\S]*?<pre>[\s\S]*?<\/pre>/gi;
      const exampleMatches = htmlContent.match(exampleRegex);
      
      if (exampleMatches) {
        for (const exampleMatch of exampleMatches) {
          const tempExampleDiv = document.createElement('div');
          tempExampleDiv.innerHTML = exampleMatch;
          
          const preContent = tempExampleDiv.querySelector('pre')?.textContent || '';
          
          const inputMatch = preContent.match(/Input:?\s*(.*?)(?=Output:|$)/i);
          const outputMatch = preContent.match(/Output:?\s*(.*?)(?=Explanation:|$)/i);
          const explanationMatch = preContent.match(/Explanation:?\s*(.*?)$/i);
          
          if (inputMatch && outputMatch) {
            examples.push({
              input: inputMatch[1].trim(),
              output: outputMatch[1].trim(),
              explanation: explanationMatch ? explanationMatch[1].trim() : undefined
            });
          }
        }
      }
    }
    
    // Method 4: Extract examples directly from original text content
    if (examples.length === 0) {
      console.log('Trying method 4 to extract examples');
      const fullText = tempDiv.textContent || '';
      
      // Find all example sections
      const exampleSections = fullText.split(/Example\s+\d+:/);
      
      // Skip the first part (it's the description)
      if (exampleSections.length > 1) {
        for (let i = 1; i < exampleSections.length; i++) {
          const section = exampleSections[i];
          
          // Extract input, output and explanation - using simple string processing instead of complex regex
          const inputIndex = section.indexOf('Input:');
          const outputIndex = section.indexOf('Output:');
          const explanationIndex = section.indexOf('Explanation:');
          
          // Determine next boundary
          const nextExampleIndex = section.indexOf('Example ', 1);
          const constraintsIndex = section.indexOf('Constraints:');
          
          if (inputIndex !== -1 && outputIndex !== -1) {
            // Extract content
            let input = '';
            let output = '';
            let explanation = '';
            
            if (inputIndex !== -1 && outputIndex !== -1) {
              input = section.substring(inputIndex + 'Input:'.length, outputIndex).trim();
            }
            
            if (outputIndex !== -1) {
              const endOfOutput = explanationIndex !== -1 ? explanationIndex : 
                                  nextExampleIndex !== -1 ? nextExampleIndex : 
                                  constraintsIndex !== -1 ? constraintsIndex : 
                                  section.length;
              output = section.substring(outputIndex + 'Output:'.length, endOfOutput).trim();
            }
            
            if (explanationIndex !== -1) {
              const endOfExplanation = nextExampleIndex !== -1 ? nextExampleIndex : 
                                      constraintsIndex !== -1 ? constraintsIndex : 
                                      section.length;
              explanation = section.substring(explanationIndex + 'Explanation:'.length, endOfExplanation).trim();
            }
            
            // Create example object
            examples.push({
              input: input.replace(/\n+/g, ' ').trim(),
              output: output.replace(/\n+/g, ' ').trim(),
              explanation: explanation ? explanation.replace(/\n+/g, ' ').trim() : undefined
            });
          }
        }
      }
    }
    
    // Method 5: Find "Input" and "Output" patterns in text content
    if (examples.length === 0) {
      console.log('Trying method 5 to extract examples');
      
      // Create a new parser using plain text
      const textContent = tempDiv.textContent || '';
      
      // Extract all Input-Output pairs
      const inputOutputPairs = [];
      const inputRegex = /Input:?\s*([^\n]*)/gi;
      let inputMatch;
      
      while ((inputMatch = inputRegex.exec(textContent)) !== null) {
        const inputStart = inputMatch.index;
        const inputContent = inputMatch[1];
        
        // Find output after the input
        const remainingText = textContent.substring(inputStart);
        const outputMatch = remainingText.match(/Output:?\s*([^\n]*)/i);
        
        if (outputMatch) {
          inputOutputPairs.push({
            input: inputContent.trim(),
            output: outputMatch[1].trim()
          });
        }
      }
      
      // Add found input-output pairs
      examples.push(...inputOutputPairs);
    }

    // Extract constraints
    let constraints = '';
    let constraintsStarted = false;
    let followUp = '';
    let followUpStarted = false;
    
    // Look for constraints section
    for (const node of Array.from(tempDiv.childNodes)) {
      const text = node.textContent || '';
      
      // Check if it's the start of constraints section
      if (text.includes('Constraints:') || text.includes('限制:')) {
        constraintsStarted = true;
        continue;
      }
      
      // Check if it's the start of follow-up section
      if (text.includes('Follow-up:') || text.includes('Follow up:') || text.includes('进阶:')) {
        constraintsStarted = false;
        followUpStarted = true;
        
        // Extract follow-up content
        const followUpMatch = text.match(/Follow-up:?(.*?)$|Follow up:?(.*?)$/i);
        if (followUpMatch) {
          followUp = (followUpMatch[1] || followUpMatch[2] || '').trim();
        } else {
          // If regex doesn't match, use the entire text
          followUp = text;
        }
        continue;
      }
      
      // If in constraints section, add content
      if (constraintsStarted && node.nodeName === 'UL') {
        const ulElement = node as Element;
        constraints += ulElement.outerHTML || '';
      }
      
      // If in follow-up section, continue adding content
      if (followUpStarted && !followUp && text.trim()) {
        followUp += text;
      }
    }

    // Debug output
    console.log("Parsed examples:", examples);
    
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
      // Remove TOC section
      let formatted = content.replace(/\[TOC\]/g, '');
      
      // Print original content for debugging
      console.log("Original solution content (first 200 chars):", formatted.substring(0, 200));
      
      // Handle various possible video section formats
      const videoPatterns = [
        /## Video Solution[\s\S]*?(?=## Solution|## Solution Article|## Overview|## Approach)/i,
        /## Official Solution[\s\S]*?(?=## Solution Article|## Overview|## Approach)/i,
        /## Solution Video[\s\S]*?(?=## Solution|## Solution Article|## Overview|## Approach)/i
      ];
      
      for (const pattern of videoPatterns) {
        if (pattern.test(formatted)) {
          formatted = formatted.replace(
            pattern,
            '## Video\n\nBecause of privacy settings, video content cannot be displayed here.\n\n'
          );
          break;
        }
      }
      
      // Multiple pattern matching to ensure all Implementation-related content is removed
      const implementationPatterns = [
        // Match from ## Implementation to the next ## heading
        /(## Implementation[\s\S]*?)(?=## |$)/i,
        
        // Match from ### Implementation to the next ### or ## heading
        /(### Implementation[\s\S]*?)(?=### |## |$)/i,
        
        // Match from # Implementation to the next # heading
        /(# Implementation[\s\S]*?)(?=# |$)/i,
        
        // Match any part with Implementation heading
        /(?:# |## |### )Implementation.*?(?=(?:# |## |### )|$)/gi,
        
        // Match Code section
        /(?:# |## |### )Code[\s\S]*?(?=(?:# |## |### )|$)/gi,
        
        // Match Java implementation section
        /(?:# |## |### )Java[\s\S]*?(?=(?:# |## |### )|$)/gi,
        
        // Match Python implementation section
        /(?:# |## |### )Python[\s\S]*?(?=(?:# |## |### )|$)/gi,
        
        // Match C++ implementation section
        /(?:# |## |### )C\+\+[\s\S]*?(?=(?:# |## |### )|$)/gi
      ];
      
      // Apply all patterns
      for (const pattern of implementationPatterns) {
        formatted = formatted.replace(pattern, '');
      }
      
      // Remove any potentially remaining "refused to connect" content
      formatted = formatted.replace(
        /<div[^>]*>[\s\S]*?leetcode\.com refused to connect[\s\S]*?<\/div>/gi,
        ''
      );
      
      formatted = formatted.replace(
        /leetcode\.com refused to connect\./gi,
        ''
      );
      
      // Process standalone code blocks, but avoid replacing code examples in algorithm explanations
      const codeBlockPattern = /```[\s\S]*?```/g;
      // Special handling sections where code blocks should not be replaced
      const exemptSections = [
        'Intuition', 'Algorithm', 'Approach', 'Example', 
        'Explanation', 'Idea', 'Analysis', 'Insight'
      ];
      
      // Check if a code block is in an exempt section
      const isInExemptSection = (position: number, text: string): boolean => {
        // Find the nearest section heading before the code block position
        const textBefore = text.substring(0, position);
        const lastSectionMatch = textBefore.match(/(?:# |## |### )([^#\n]+)(?:\n|$)/i);
        
        if (lastSectionMatch) {
          const sectionTitle = lastSectionMatch[1].trim();
          // Check if this section title is in the exempt list
          return exemptSections.some(exempt => 
            sectionTitle.toLowerCase().includes(exempt.toLowerCase())
          );
        }
        return false;
      };
      
      // Replace standalone code blocks not in exempt sections
      let lastIndex = 0;
      let match;
      let result = '';
      const codeBlockRegex = /```[\s\S]*?```/g;
      
      while ((match = codeBlockRegex.exec(formatted)) !== null) {
        if (!isInExemptSection(match.index, formatted)) {
          // Replace this code block with nothing (complete removal)
          result += formatted.substring(lastIndex, match.index);
          // We don't add any placeholder div here, just skip the code block
        } else {
          // Keep code blocks in exempt sections
          result += formatted.substring(lastIndex, match.index + match[0].length);
        }
        lastIndex = match.index + match[0].length;
      }
      
      // Add remaining text
      if (lastIndex < formatted.length) {
        result += formatted.substring(lastIndex);
      }
      
      // Only replace if matches were found
      if (result) {
        formatted = result;
      }
      
      // Remove images and Figure markings (various possible formats)
      const imagePatterns = [
        /!\[(.*?)\][\s\S]*?\*Figure[\s\S]*?\*(?:\n+##?)?/g,
        /!\[(.*?)\]\((.*?)\)/g,
        /!\?!.*?!\?!/g,
        /<img[\s\S]*?>/g
      ];
      
      for (const pattern of imagePatterns) {
        formatted = formatted.replace(
          pattern,
          '<div class="image-placeholder">Image not available in extension</div>'
        );
      }
      
      // Remove all iframe elements to prevent CSP errors
      formatted = formatted.replace(
        /<iframe[\s\S]*?<\/iframe>/gi,
        '<div class="iframe-placeholder">Interactive code playground not available in extension</div>'
      );
      
      // Remove div containers that might have held iframes
      formatted = formatted.replace(
        /<div[^>]*class="video-container"[^>]*>[\s\S]*?<\/div>/gi,
        '<div class="video-placeholder">Video content not available in extension</div>'
      );
      
      // Remove all dividers and special markings
      formatted = formatted.replace(/---/g, '');
      formatted = formatted.replace(/##(?!\s)/g, '');
      formatted = formatted.replace(/\*\*\*+/g, ''); // Remove multiple asterisks dividers
      
      // Handle heading formats
      formatted = formatted.replace(/##\s+(.*?)(?:\n|$)/g, '<h2>$1</h2>');
      formatted = formatted.replace(/###\s+(.*?)(?:\n|$)/g, '<h3>$1</h3>');
      formatted = formatted.replace(/#\s+(.*?)(?:\n|$)/g, '<h4>$1</h4>');
      
      // Handle bold text
      formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      
      // Handle italics (image captions)
      formatted = formatted.replace(/\*(Figure[\s\S]*?)\*/g, '');
      formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
      
      // Handle math expressions and special symbols
      formatted = formatted.replace(/\$\$(.*?)\$\$/g, '<code>$1</code>');
      formatted = formatted.replace(/\$(.*?)\$/g, '<code>$1</code>');
      formatted = formatted.replace(/\\le/g, '≤');
      formatted = formatted.replace(/\\cdot/g, '·');
      formatted = formatted.replace(/\\log/g, 'log');
      formatted = formatted.replace(/\\text\{([^}]*)\}/g, '$1');
      
      // Format inline code with backticks
      formatted = formatted.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
      
      // Handle code blocks
      formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<pre class="code-block${lang ? ` language-${lang}` : ''}"><code>${code.trim()}</code></pre>`;
      });
      
      // Handle list items
      formatted = formatted.replace(/^\* (.*?)$/gm, '<li>$1</li>');
      formatted = formatted.replace(/^- (.*?)$/gm, '<li>$1</li>');
      formatted = formatted.replace(/^(\d+)\. (.*?)$/gm, '<li>$1. $2</li>');
      
      // Handle paragraphs
      formatted = formatted.replace(/\n\n/g, '</p><p>');
      
      // Add basic styles
      formatted = `
        <style>
          .solution-content {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .solution-content h2 {
            margin-top: 1.8em;
            margin-bottom: 0.8em;
            font-size: 1.4em;
            color: #1a1a1a;
            border-bottom: 1px solid #eee;
            padding-bottom: 0.3em;
          }
          .solution-content h3 {
            margin-top: 1.5em;
            margin-bottom: 0.5em;
            font-size: 1.2em;
            color: #333;
          }
          .solution-content h4 {
            margin-top: 1.2em;
            margin-bottom: 0.5em;
            font-size: 1.1em;
            color: #333;
          }
          .solution-content p {
            margin: 0.8em 0;
            line-height: 1.6;
          }
          .solution-content code {
            background-color: #f6f8fa;
            padding: 0.2em 0.4em;
            border-radius: 3px;
            font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
            font-size: 0.9em;
          }
          .solution-content .inline-code {
            background-color: #f0f0f0;
            color: #e83e8c;
            padding: 0.1em 0.3em;
            border-radius: 3px;
            font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
            font-size: 0.9em;
            white-space: nowrap;
          }
          .solution-content pre {
            background-color: #f6f8fa;
            padding: 1em;
            border-radius: 6px;
            overflow-x: auto;
            margin: 1em 0;
          }
          .solution-content pre code {
            background-color: transparent;
            padding: 0;
            font-size: 0.9em;
          }
          .solution-content li {
            margin: 0.5em 0;
          }
          .solution-content ul, .solution-content ol {
            padding-left: 2em;
            margin: 0.8em 0;
          }
          .solution-content strong {
            font-weight: 600;
            color: #000;
          }
          .solution-content .image-placeholder, .solution-content .code-placeholder {
            background-color: #f1f1f1;
            border: 1px dashed #ccc;
            color: #666;
            text-align: center;
            padding: 2em 1em;
            margin: 1em 0;
            border-radius: 4px;
          }
          .solution-content .code-placeholder {
            background-color: #f8f8f8;
          }
          .solution-content .iframe-placeholder,
          .solution-content .video-placeholder {
            background-color: #f0f0f0;
            border: 1px dashed #aaa;
            color: #666;
            text-align: center;
            padding: 2em 1em;
            margin: 1em 0;
            border-radius: 4px;
            font-style: italic;
          }
          .implementation-message {
            background-color: #f8f8f8;
            border: 1px solid #e1e4e8;
            border-radius: 6px;
            padding: 1em;
            margin: 1em 0;
            text-align: center;
            color: #666;
          }
          .connection-error {
            background-color: #fff8f8;
            border: 1px solid #ffdce0;
            color: #86181d;
            border-radius: 4px;
            padding: 1em;
            margin: 1em 0;
            text-align: center;
            font-style: italic;
          }
          .language-tabs {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 10px;
          }
          .language-tab {
            background-color: #e1e4e8;
            color: #24292e;
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 0.9em;
            font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
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

  return (
    <div className="leetcode-scraper">
      <h2>LeetCode Data Scraper</h2>
      
      <div className="actions">
        <button 
          onClick={scrapeCurrentPage} 
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : 'Fetch Current Problem Data'}
        </button>
        
        {problemData && (
          <button 
            onClick={() => {
              // 强制刷新数据
              chrome.storage.local.remove('leetcodeData', () => {
                console.log('Cache cleared, fetching fresh data');
                scrapeCurrentPage();
              });
            }}
            disabled={isLoading}
            title="Force refresh to get the latest data"
          >
            Refresh Data
          </button>
        )}
        
        <button 
          onClick={exportData} 
          disabled={!problemData || isLoading}
        >
          {exported ? 'Exported!' : 'Export Data'}
        </button>

        <button 
          onClick={clearData} 
          disabled={!problemData || isLoading}
        >
          Clear Data
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {problemData && (
        <div className="problem-data">
          <h3>Problem Information</h3>
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
          
          {problemData.parsedContent ? (
            <div className="parsed-content">
              {problemData.parsedContent.description && (
                <div className="description">
                  <h4>Description</h4>
                  <div dangerouslySetInnerHTML={{ __html: problemData.parsedContent.description }} />
                </div>
              )}
              
              {problemData.parsedContent.examples && problemData.parsedContent.examples.length > 0 && (
                <div className="examples">
                  <h4>Examples</h4>
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
                </div>
              )}
              
              {problemData.parsedContent.constraints && (
                <div className="constraints">
                  <h4>Constraints</h4>
                  <div dangerouslySetInnerHTML={{ __html: problemData.parsedContent.constraints }} />
                </div>
              )}
              
              {problemData.parsedContent.followUp && (
                <div className="follow-up">
                  <h4>Follow-up</h4>
                  <p>{problemData.parsedContent.followUp}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="content-preview">
              <strong>Description Preview:</strong>
              <div dangerouslySetInnerHTML={{ __html: problemData.content.substring(0, 200) + '...' }} />
            </div>
          )}

          {problemData.solution && problemData.solution.content && (
            <div className="solution-preview">
              <h4>Official Solution</h4>
              <SolutionDisplay content={problemData.solution.content} />
            </div>
          )}

          {!problemData.solution?.content && (
            <div className="solution-premium">
              <h4>Official Solution</h4>
              <p>Premium subscription required to view the official solution.</p>
            </div>
          )}
        </div>
      )}

      {problemData?.userCode && (
        <div className="user-code">
          <h3>User Code</h3>
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
        </div>
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