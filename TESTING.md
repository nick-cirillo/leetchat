# Testing guide

This document describes our testing strategy for LeetChat, divided into two categories: Interface Testing and Prompt Testing.

Explanation of testing approach: We used a manual testing approach for this project. The interface is tested through walkthroughs in the browser, and prompts are tested by sending inputs to a language model (ChatGPT 4o, Claude Sonnet 3.7) and evaluating the output.

---

## Interface Testing

There are three key inputs to the extension:

1. The **LeetCode problem page**
2. The **user’s code** within the embedded code editor on LeetCode
3. The **custom prompt input** in the extension

While most, if not all, LeetCode problems follow the same DOM structure, it is worth testing a variety of different problems in case different types of symbols or inline formatting present issues. With the user code, this is a JavaScript embedding - but it is ultimately wrapping a text input, like the custom prompt option in our extension. Thus, to test these extensively, we had to ensure all user-inputted characters will be validly scraped, even characters that might be read as an "escape."

### Manual Walkthrough Strategy

* Verify correct DOM scraping on various LeetCode problems to ensure consistent behavior across different problems and formats.
* Ensure the JavaScript embedding for user code is handled correctly.
* Confirm that all user-inputted characters (including edge cases like escape characters or special syntax) are parsed and passed to the prompt accurately.
* Validate that the extension behaves properly when no code is written, or when only a partial solution is available.

Examples of specific steps taken:

1. Loading the unpacked extension in Chrome.
2. Verifying the data scraped is correct for different LeetCode pages.
3. Testing the "Copy" feature with various inputs.
4. Test the dropdown and "Open with" buttons for all LLM options.

---

## Prompt Testing

### Test Case 1: Asking for Solution/Corrections

* **Description**: The extension scrapes the "Two Sum" problem from LeetCode, where the user has submitted an incorrect and brute-force solution that returns values instead of indices.

* **Description of Inputs**: The page being scraped is the leetcode page for the "Two Sum" problem (<https://leetcode.com/problems/two-sum/description/>), and we are using prompt type "Solve". The user has already inputted an incorrect and brute-force solution. The prompt that our extension produces is the following:
    '''
        Problem #1: Two Sum
        Difficulty: Easy
        Tags: Array, Hash Table

        Description: Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.

        You may assume that each input would have exactly one solution, and you may not use the same element twice.

        You can return the answer in any order.

         


        Examples:
        Example 1:
        Input: nums = [2,7,11,15], target = 9
        Output: [0,1]
        Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].

        Example 2:
        Input: nums = [3,2,4], target = 6
        Output: [1,2]

        Example 3:
        Input: nums = [3,3], target = 6
        Output: [0,1]

        Constraints:
        2 <= nums.length <= 104
            -109 <= nums[i] <= 109
            -109 <= target <= 109
            Only one valid answer exists.

        Follow-up: Can you come up with an algorithm that is less than 

        User Code:
        ```
        class Solution {
        public:
            vector<int> twoSum(vector<int>& nums, int target) {
                for (int i = 0; i < nums.size(); i++) {
                    for (int j = i + 1; j < nums.size(); j++) {
                        if (nums[i] + nums[j] == target) {
                            return {nums[i], nums[j]};
                        }
                    }
                }
                return {};
            }
        };
        ```



        Please walk me through the solution to this LeetCode problem. Please focus on the errors in my thinking about the data structures and algorithms. I want to understand the problem and solution thoroughly.
    '''

* **Expected Output**: While this algorithm has a brute force solution, better solutions utilize hashing, as outlined in this article: <https://interviewing.io/questions/two-sum#solution1>. The output of the LLM should lay out the particular error in the user's solution (returning the values rather than the indices), as well as how to improve on it to avoid using brute force.

* **Model Used**: ChatGPT 4o

* **Current Behavior**: See below.
'''
Absolutely! You're off to a good start by attempting a brute-force solution. Let's go through the problem, understand what's being asked, and then review your code — focusing especially on the **algorithmic thinking** and **data structures** involved.

---

## ✅ **Understanding the Problem**

You're given:

* An array of integers: `nums`
* An integer: `target`

Goal:

* Return **indices** (not values!) of the **two distinct elements** in `nums` that **add up to** `target`.

**Important Constraints:**

* There is **exactly one solution**.
* You **can't use the same element twice**.
* You can return the indices in any order.

---

## ❌ **What’s Wrong in Your Code?**

Your code uses **two nested loops** to check all possible pairs. That’s fine for a brute-force solution, but there are two problems:

### 🔴 1. You return the **values**, not the **indices**:

'''
return {nums[i], nums[j]}; // This returns the values, e.g., [2, 7]
'''

✅ You should return:

'''
return {i, j}; // This returns the indices, e.g., [0, 1]
'''

### ⚠️ 2. Brute-force is slow for large arrays

Your current approach has **O(n²)** time complexity because it checks every pair. That's okay for small inputs, but it won't scale well (given `nums.length` can be up to 10,000).

---

## ✅ **Optimal Approach: Use a Hash Map**

To improve efficiency, we use a **hash table (unordered\_map in C++)** to store the **complement** of each element as we iterate.

### 🧠 Key Idea:

If `a + b = target`, and we already saw `a`, then when we reach `b`, we know the solution is `(index of a, index of b)`.

### ✅ Algorithm Steps:

1. Initialize a hash map `num_to_index`.
2. Loop through the array:

* For each `nums[i]`, compute `complement = target - nums[i]`.
* Check if `complement` is in the map.

* If it is, return `[map[complement], i]`.
* Otherwise, store `nums[i]` with its index in the map.

### 💡 Time and Space Complexity:

* **Time:** O(n)
* **Space:** O(n)

---

## ✅ Corrected & Optimized Code

'''
class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> num_to_index;

        for (int i = 0; i < nums.size(); ++i) {
            int complement = target - nums[i];
            if (num_to_index.count(complement)) {
                return {num_to_index[complement], i};
            }
            num_to_index[nums[i]] = i;
        }

        return {}; // Just a fallback; problem guarantees one solution
    }
};
'''
'''

* **Actual Output**:
* The output corrects the code and explains the solution, as expected.

### Test Case 2: Asking for Explanation/Teaching

* **Description**: The extension scrapes the "Reverse Integer" problem from LeetCode, where in this case the user has not yet attempted their own solution.

* **Description of Inputs**: The page being scraped is the leetcode page for the "Reverse Intever" problem (<https://leetcode.com/problems/two-sum/description/>), and we are using prompt type "Explain". The user input is only the default/already given code from LeetCode. The prompt that our extension produces is the following:
    '''
        Problem #7: Reverse Integer
        Difficulty: Medium
        Tags: Math

        Description: Given a signed 32-bit integer x, return x with its digits reversed. If reversing x causes the value to go outside the signed 32-bit integer range [-231, 231 - 1], then return 0.

        Assume the environment does not allow you to store 64-bit integers (signed or unsigned).

         


        Examples:
        Example 1:
        Input: x = 123
        Output: 321

        Example 2:
        Input: x = -123
        Output: -321

        Example 3:
        Input: x = 120
        Output: 21

        Constraints:
        -231 <= x <= 231 - 1

        User Code:
        ```
        class Solution {
        public:
            int reverse(int x) {

            }
        };
        ```
        Please explain this LeetCode problem to me without giving me the solution. Act as if you are a teacher and I am a student. Please explain the problem in detail, including the input and output format, constraints, and any edge cases. Check my understanding of the underlying data structures and algorithms. Please do not give me the solution and show restraint with hints. I want to understand the problem thoroughly.
    '''

* **Expected Output**: The output of the LLM should explain the problem specifications and provide guiding hints, guiding the user like a teacher would without outright revealing any solutions.

* **Model Used**: ChatGPT 4o

* **Current Behavior**: See below.
'''

I'll explain this problem thoroughly without giving away the solution.

## Problem Breakdown

The challenge asks you to reverse the digits of a signed 32-bit integer. Let's break down what this means:

1. **Input**: A signed 32-bit integer `x` (can be positive or negative)
2. **Output**: The same integer with its digits reversed
3. **Special case**: If the reversed number falls outside the 32-bit integer range, return 0

## Examples Analysis

Let's analyze the examples:

**Example 1:**

* Input: `x = 123`
* Output: `321`
* Explanation: The digits of 123 are reversed to form 321

**Example 2:**

* Input: `x = -123`
* Output: `-321`
* Explanation: The negative sign remains, but the digits 123 are reversed to 321

**Example 3:**

* Input: `x = 120`
* Output: `21`
* Explanation: The digits are reversed (021), but leading zeros are dropped, giving 21

## Key Considerations

### 1. Integer Range Constraint

The 32-bit signed integer range is [-2^31, 2^31 - 1], which is approximately [-2.15 billion, 2.15 billion]. If the reversed number exceeds this range, you must return 0.

### 2. No 64-bit Integer Storage

You cannot use 64-bit integers during the calculation. This is a crucial constraint because the reversed number might temporarily exceed the 32-bit range during computation.

### 3. Handling Signs

The sign of the number must be preserved. Only the digits are reversed.

### 4. Trailing Zeros

As seen in Example 3, any trailing zeros in the original number become leading zeros in the reversed number and are dropped.

## Edge Cases to Consider

1. **Overflow Detection**: How will you detect if the reversed number goes out of range?
2. **Single Digit Numbers**: What happens with numbers like 7 or -9?
3. **Boundary Values**: What about extreme values like -2^31 or 2^31-1?
4. **Zero**: What does reversing 0 give you?

## Understanding Check

Before proceeding, make sure you understand:

1. How to extract and manipulate digits of a number
2. How to handle the sign of the number
3. How to build a new number by adding digits
4. How to detect potential overflow without using 64-bit integers

## Algorithm Approach (Without Solution)

You'll need to think about:

* A method to extract digits from the input number
* A way to construct the reversed number
* A technique to check for potential overflow at each step

Do you have any questions about the problem or need clarification on any part of it?
'''

* **Actual Output**:
* The output is informative, and provides guidance/hints rather than a direct solution, as expected for this prompt type.
