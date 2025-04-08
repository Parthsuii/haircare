// gemini-fetch.js
async function generateContentWithFetch(apiKey, prompt) {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not provided.");
    }
  
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-001:generateContent?key=${apiKey}`;
  
    const data = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048, // Increased to ensure full response
      },
    };
  
    try {
      console.log("Sending request to Gemini API...");
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Gemini API Error Response:", errorData);
        throw new Error(
          `HTTP error! status: ${response.status}, details: ${JSON.stringify(errorData)}`
        );
      }
  
      const result = await response.json();
      console.log("Gemini API Full Response:", JSON.stringify(result, null, 2));
  
      if (!result.candidates || !result.candidates[0]) {
        throw new Error("No candidates in response");
      }
  
      const candidate = result.candidates[0];
      if (!candidate.content || !candidate.content.parts || !candidate.content.parts[0]) {
        throw new Error("Invalid response structure");
      }
  
      const text = candidate.content.parts[0].text;
      if (!text || typeof text !== "string") {
        throw new Error("Invalid text in response");
      }
  
      console.log("Raw response text:", text); // Debug raw text
      return text;
    } catch (error) {
      console.error("Gemini API Error:", error);
      throw error;
    }
  }
  
  async function generateCarePlanFetch(surveyData, apiKey) {
    if (!apiKey) {
      console.error("API key is not provided.");
      return {
        error: "API key is missing. Please configure a valid GEMINI_API_KEY in your .env file.",
      };
    }
  
    const prompt = `
      You are a professional hair care specialist. Based on the following detailed survey responses, provide a structured response in plain text with the following sections exactly as specified. Ensure each section starts on a new line and contains the requested data. Do not use brackets or extra formatting:
  
      Ingredients:
      List of ingredients separated by commas
  
      Wash Frequency:
      Recommended wash frequency
  
      Recommendations:
      List of recommendations, one per line
  
      Instructions:
      Step-by-step instructions, one per line, corresponding to the order of ingredients
  
      Survey Data:
      - Hair Type: ${surveyData.hairType || "Not specified"}
      - Hair Texture: ${surveyData.hairTexture || "Not specified"}
      - Hair Porosity: ${surveyData.porosity || "Not specified"}
      - Scalp Condition: ${surveyData.scalpCondition || "Not specified"}
      - Product Use: ${surveyData.productUse || "Not specified"}
      - Styling Habits: ${surveyData.stylingHabits || "Not specified"}
      - Hair Goals: ${surveyData.hairGoals || "Not specified"}
      - Lifestyle: ${surveyData.lifestyle || "Not specified"}
    `;
  
    try {
      console.log("Generating care plan with prompt:", prompt);
      const text = await generateContentWithFetch(apiKey, prompt);
      console.log("Received response text:", text);
  
      if (typeof text !== "string") {
        console.error("Validation failed: API response is not a string.", { type: typeof text, value: text });
        return { error: "Invalid response from Gemini API (expected a string)" };
      }
  
      let parsedResponse = {};
      try {
        // Split into lines and trim
        const lines = text.split("\n").map(line => line.trim()).filter(line => line.length > 0);
        console.log("Processed lines:", lines); // Debug lines
  
        // Extract sections with flexible matching
        parsedResponse = {
          ingredients: (lines.find(line => line.toLowerCase().startsWith("ingredients:"))?.replace(/ingredients:/i, "").trim().split(",").map(item => item.trim()) || []).filter(Boolean) || ["No ingredients found"],
          washFrequency: (lines.find(line => line.toLowerCase().startsWith("wash frequency:"))?.replace(/wash frequency:/i, "").trim() || "Not specified"),
          recommendations: lines.slice(lines.findIndex(line => line.toLowerCase().startsWith("recommendations:")) + 1, lines.findIndex(line => line.toLowerCase().startsWith("instructions:"))).filter(line => line && !line.toLowerCase().startsWith("instructions:")) || [],
          instructions: lines.slice(lines.findIndex(line => line.toLowerCase().startsWith("instructions:")) + 1).filter(line => line && !line.toLowerCase().startsWith("survey data:")) || [],
        };
        // Map instructions to ingredients as an object
        parsedResponse.instructions = parsedResponse.ingredients.reduce((obj, ingredient, index) => {
          obj[ingredient] = parsedResponse.instructions[index] || "No specific instructions available.";
          return obj;
        }, {});
        console.log("Parsed response successfully:", JSON.stringify(parsedResponse, null, 2));
      } catch (parseError) {
        console.error("Error occurred during response parsing:", parseError);
        console.error("Text that caused parsing error:", text);
        return { error: `Error parsing hair care plan: ${parseError.message}`, rawResponse: text };
      }
  
      if (parsedResponse.ingredients.length === 0 && !parsedResponse.error) {
        console.warn("No ingredients parsed, using fallback...");
        const fallbackIngredients = text.match(/[A-Za-z\s,]+(?=\nWash Frequency:|\nRecommendations:|\nInstructions:|\nSurvey Data:|$)/i)?.[0]?.split(",").map(item => item.trim()) || ["No ingredients found"];
        parsedResponse.ingredients = fallbackIngredients;
        parsedResponse.instructions = fallbackIngredients.reduce((obj, ingredient, index) => {
          obj[ingredient] = "No specific instructions available.";
          return obj;
        }, {});
        console.log("Fallback parsed response:", JSON.stringify(parsedResponse, null, 2));
      }
  
      return parsedResponse;
    } catch (fetchError) {
      console.error("Error during Gemini API call:", fetchError);
      return {
        error: `Failed to get plan from AI: ${fetchError.message || "Unknown API error"}`,
        rawResponse: fetchError.message,
      };
    }
  }
  
  module.exports = { generateCarePlanFetch };