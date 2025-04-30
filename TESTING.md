# Testing guide

There are three inputs to the extension - the LeetCode page, the user code on the LeetCode page, and the "custom prompt" option in the extension.

While most, if not all, LeetCode problems follow the same DOM structure, it is worth testing a variety of different problems in case different types of symbols or inline formatting present issues.

With the user code, this is a JavaScript embedding - but it is ultimately wrapping a text input, like the custom prompt option in our extension. Thus, to test these extensively, ensure all user-inputted characters will be validly scraped, even characters that might be read as an "escape."