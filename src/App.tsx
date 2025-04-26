import React, { useState } from "react";
import "./App.css";

function App() {
  // State for the selected prompt type
  const [selectedPrompt, setSelectedPrompt] = useState<string>("Custom");
  // State for the custom prompt text
  const [customPromptText, setCustomPromptText] = useState<string>("");
  // State for the output text field
  const [outputText, setOutputText] = useState<string>("");

  // Function to handle prompt type selection and update the output text
  const handlePromptChange = (promptType: string) => {
    setSelectedPrompt(promptType);
    if (promptType === "Custom") {
      setOutputText(customPromptText); // Use the custom prompt text
    } else {
      const promptText = getPromptText(promptType); // Get the prompt text for the selected type
      console.log(promptText);
      setOutputText(promptText); // Update the output text
    }
  };

  // Function to get the prompt text based on the selected option
  const getPromptText = (promptType: string) => {
    switch (promptType) {
      case "Custom":
        return customPromptText;
      case "Explain":
        return "Please explain this LeetCode problem to me without giving me the solution. Act as if you are a teacher and I am a student. Please explain the problem in detail, including the input and output format, constraints, and any edge cases. Check my understanding of the underlying data structures and algorithms. Please do not give me the solution and show restraint with hints. I want to understand the problem thoroughly.";
      case "Debug":
        return "Please help me debug my LeetCode problem code and identify which test cases are passing/failing. Please do not give me the solution and show restraint with hints. I want to understand the problem thoroughly. Please walk me through the debugging process step by step. Focus on the errors in my thinking about the data structures and algorithms.";
      case "Solve":
        return "Please walk me through the solution to this LeetCode problem. Please focus on the errors in my thinking about the data structures and algorithms. I want to understand the problem and solution thoroughly.";
      default:
        return "";
    }
  };

  const openAiService = (service: string) => {
    const urls: { [key: string]: string } = {
      ChatGPT: "https://chat.openai.com/",
      Claude: "https://claude.ai/",
      Gemini: "https://gemini.google.com/",
      Deepseek: "https://chat.deepseek.com/",
      Perplexity: "https://www.perplexity.ai/",
      Grok: "https://grok.com/chat"
    };
  
    if (urls[service]) {
      window.open(urls[service], "_blank");
    } else {
      console.error("Service URL not found");
    }
  };

  // Function to handle scraping and appending the prompt
  const runScraper = () => {
    console.log("Scraper function called");
    const scrapedContent = "Scraped content goes here."; // Placeholder for scraped content
    const promptText = getPromptText(selectedPrompt);
    setOutputText(`${promptText}\n\n"""${scrapedContent}"""`);
  };

  // Function to handle copying text to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(outputText);
  };

  return (
    <div className="App">
      <div className="scrape-section">
        <button className="scrape-button" onClick={runScraper}>
          Scrape
        </button>
      </div>

      <div className="prompt-options">
        <h3>Prompt Type</h3>
        <div className="radio-group">
          {["Custom", "Explain", "Debug", "Solve"].map((promptType) => (
            <label key={promptType} className="radio-label">
              <input
                type="radio"
                name="promptType"
                value={promptType}
                checked={selectedPrompt === promptType}
                onChange={() => handlePromptChange(promptType)}
              />
              {promptType}
            </label>
          ))}
        </div>
      </div>

      {selectedPrompt === "Custom" && (
        <div className="custom-prompt">
          <textarea
            placeholder="Enter your custom prompt..."
            value={customPromptText}
            onChange={(e) => {
              setCustomPromptText(e.target.value);
              setOutputText(e.target.value); // Update output text as the user types
            }}
            rows={3}
          />
        </div>
      )}

      <div className="output-section">
        <textarea
          className="output-field"
          placeholder="Extracted code/text will appear here..."
          value={outputText}
          onChange={(e) => setOutputText(e.target.value)}
          rows={8}
        />
        <button className="copy-button" onClick={handleCopy}>
          Copy
        </button>
      </div>

      <div className="ai-services">
        <h3>Open with:</h3>
        <div className="service-buttons">
          {["ChatGPT", "Claude", "Gemini", "Deepseek", "Perplexity"].map(
            (service) => (
              <button
                key={service}
                className="ai-service-button"
                onClick={() => openAiService(service)}
              >
                {service}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default App;