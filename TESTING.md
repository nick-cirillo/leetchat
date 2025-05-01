# Testing Guide

## 1. **Input Handling Testing**

There are three inputs to the extension - the LeetCode page, the user code on the LeetCode page, and the "custom prompt" option in the extension.

While most, if not all, LeetCode problems follow the same DOM structure, it is worth testing a variety of different problems in case different types of symbols or inline formatting present issues.

With the user code, this is a JavaScript embedding - but it is ultimately wrapping a text input, like the custom prompt option in our extension. Thus, to test these extensively, ensure all user-inputted characters will be validly scraped, even characters that might be read as an "escape."

---

## 2. Interface Testing

### Approach

- Manual  
- We conduct manual testing specifically for the scraper component, as LeetCode requires user authentication to access submitted code and test results. Automating this process with Playwright is currently unreliable — even with JavaScript-based login scripts, LeetCode frequently detects automated Chromium sessions as bots and restricts access. Due to this limitation, end-to-end automation is not feasible at the moment for authenticated interactions. We are aware of this issue and plan to implement a workaround or fix within the next few days, potentially involving authenticated sessions with preloaded cookies。

### Details
- We already tested the following cases:
1. Basic scraper with LeetCode [Two Sum](https://leetcode.com/problems/two-sum/)  
   Special input case tested:
   ```js
   const msg = `Hello\nWorld\t😊`;
   const regex = /^[A-Z]+\w*\s*$/gm;
   console.log("Test passed \\n \\t ✔️", regex.test("HELLO world "));
   ```

   ```js
   /**
    * Highlighted comments should not break extraction
    * Test: 🤖 + 🧪
    */
   var foo = function() {
     return `🔥 Hello \u2602️`;
   };
   ```  
   Both of these and some general small cases passed successfully.

- Functionality bug: The mathematical expression from the "Follow-up" part in the problem description did not render well in the UI, **already fixed**.

2. Long code case with [Add Two Numbers](https://leetcode.com/problems/add-two-numbers/description/) 
   - Bug: Can only see half of the code.  
   - What you were looking for: layout issues, functionality bugs, **already fixed**.

---

## 3. Prompt Injection and Encoding Testing

