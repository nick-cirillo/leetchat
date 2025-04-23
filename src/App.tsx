// File: src/App.tsx
import React, { useState } from "react";
import "./App.css";
import Hello from "./components/Hello";

function App() {
  // State for the selected prompt type
  const [selectedPrompt, setSelectedPrompt] = useState<string>("Explain");
  // State for the custom prompt text
  const [customPromptText, setCustomPromptText] = useState<string>("");
  // State for the output text field
  const [outputText, setOutputText] = useState<string>("");

  // Empty function to handle scraping
  const runScraper = () => {
    console.log("Scraper function called");
    // Implementation to be added later
  };


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

  return (
    <div className="App">
      <h1>Starter Extension</h1>
      {/* Render the SnippetList component with the snippets and event handlers */}
      <Hello person="World" />
      <div className="scrape-section">
        <button className="scrape-button" onClick={runScraper}>
          Scrape
        <button className="scrape-button" onClick={runScraper}>
          Scrape
        </button>
      </div>

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