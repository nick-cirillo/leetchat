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
        return "Please explain this problem to me without giving me the solution.";
      case "Debug":
        return "Please help me debug my code, identify which test cases are passing/failing.";
      case "Solve":
        return "Please walk me through the solution.";
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