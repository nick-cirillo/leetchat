import React, { useState } from "react";
import "./App.css";
import LeetcodeScraper from "./components/LeetcodeScraper";

function App() {
  // State for the selected prompt type
  const [selectedPrompt, setSelectedPrompt] = useState<string>("Explain");
  // State for the custom prompt text
  const [customPromptText, setCustomPromptText] = useState<string>("");
  // State for the output text field
  const [outputText, setOutputText] = useState<string>("");
  // State to show/hide the LeetCode scraper
  const [showLeetcodeScraper, setShowLeetcodeScraper] = useState<boolean>(false);

  // Function to handle copying text to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(outputText);
  };

  // Function to open AI service in new tab
  const openAiService = (service: string) => {
    const urls: {[key: string]: string} = {
      'ChatGPT': 'https://chat.openai.com/',
      'Claude': 'https://claude.ai/',
      'Gemini': 'https://gemini.google.com/',
      'Deepseek': 'https://chat.deepseek.com/',
      'Perplexity': 'https://www.perplexity.ai/'
    };

    if (urls[service]) {
      window.open(urls[service], '_blank');
    }
  };

  // Toggle LeetCode scraper visibility
  const toggleLeetcodeScraper = () => {
    setShowLeetcodeScraper(!showLeetcodeScraper);
  };

  return (
    <div className="App">
      <div className="scrape-section">
        <button className="scrape-button" onClick={toggleLeetcodeScraper}>
          {showLeetcodeScraper ? "Hide LeetCode Tool" : "Show LeetCode Tool"}
        </button>
      </div>

      {showLeetcodeScraper && (
        <div className="leetcode-scraper-container">
          <LeetcodeScraper />
        </div>
      )}

      <div className="prompt-options">
        <h3>Prompt Type</h3>
        <div className="radio-group">
          {["Explain", "Debug", "Solve", "Custom"].map(promptType => (
            <label key={promptType} className="radio-label">
              <input
                type="radio"
                name="promptType"
                value={promptType}
                checked={selectedPrompt === promptType}
                onChange={() => setSelectedPrompt(promptType)}
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
            onChange={(e) => setCustomPromptText(e.target.value)}
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
          {['ChatGPT', 'Claude', 'Gemini', 'Deepseek', 'Perplexity'].map(service => (
            <button 
              key={service} 
              className="ai-service-button"
              onClick={() => openAiService(service)}
            >
              {service}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
