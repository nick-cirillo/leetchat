/**
 * LeetCode API Service
 * Used to fetch LeetCode problem content, editor content and execution results
 */

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
}

interface ProblemResponse {
  data: {
    question: ProblemData;
  };
}

export class LeetcodeAPI {
  /**
   * Get problem information
   * @param titleSlug Problem URL slug
   */
  static async getProblemData(titleSlug: string): Promise<ProblemData | null> {
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
        credentials: 'omit', // Don't send cookies to avoid cross-origin issues
        body: JSON.stringify({
          query: PROBLEM_QUERY,
          variables: { titleSlug },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json() as ProblemResponse;
      return data.data.question;
    } catch (error) {
      console.error('Error fetching problem data:', error);
      return null;
    }
  }

  /**
   * Scrape user code from current page
   */
  static getUserCode(): string | null {
    // Get code from the editor
    // Note: This selector needs to be adjusted based on LeetCode's actual DOM structure
    const codeEditor = document.querySelector('.monaco-editor');
    if (!codeEditor) {
      return null;
    }
    
    // This needs to be adjusted based on LeetCode's editor implementation
    // If LeetCode uses Monaco editor, we may need to use its API
    // This is just an example, actual implementation may differ
    return (window as any).monaco?.editor?.getModels()[0]?.getValue() || null;
  }

  /**
   * Check if current page is a LeetCode problem page
   */
  static isOnProblemPage(): boolean {
    return window.location.href.includes('leetcode.com/problems/');
  }

  /**
   * Extract the titleSlug from the URL
   */
  static getTitleSlugFromUrl(): string | null {
    const match = window.location.pathname.match(/\/problems\/([^/]+)/);
    return match ? match[1] : null;
  }
} 