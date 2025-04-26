import React, { useState } from "react";

const LLMCopyTool: React.FC = () => {
  const [text, setText] = useState<string>("Your scraped or generated text here...");
  const [selectedLLM, setSelectedLLM] = useState<string>("ChatGPT");

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    alert("Text copied to clipboard!");
  };

  const openLLM = () => {
    const urls: { [key: string]: string } = {
      ChatGPT: "https://chat.openai.com/",
      Claude: "https://claude.ai/",
      Gemini: "https://gemini.google.com/",
      Perplexity: "https://www.perplexity.ai/",
      DeepSeek: "https://chat.deepseek.com/",
    };

    const url = urls[selectedLLM];
    if (url) {
      window.open(url, "_blank");
    } else {
      alert("Please select a valid LLM.");
    }
  };

  return (
    <div style={{ marginTop: "20px" }}>
      <h2>LLM Copy Tool</h2>

      <textarea
        placeholder="Your extracted or generated content..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        style={{ width: "100%", marginBottom: "10px" }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <button onClick={handleCopy}>Copy to Clipboard</button>

        <select value={selectedLLM} onChange={(e) => setSelectedLLM(e.target.value)}>
          <option value="ChatGPT">ChatGPT</option>
          <option value="Claude">Claude</option>
          <option value="Gemini">Gemini</option>
          <option value="Perplexity">Perplexity</option>
          <option value="DeepSeek">DeepSeek</option>
        </select>

        <button onClick={openLLM}>Open {selectedLLM}</button>
      </div>
    </div>
  );
};

export default LLMCopyTool;