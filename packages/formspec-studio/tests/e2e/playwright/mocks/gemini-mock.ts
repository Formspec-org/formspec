import { type Page } from '@playwright/test';

/**
 * Mocks the Gemini API responses for conversational form building.
 * Intercepts POST requests to generativelanguage.googleapis.com.
 */
export async function mockGeminiResponses(page: Page) {
  await page.route('**/generativelanguage.googleapis.com/**', async (route) => {
    const url = route.request().url();
    const postData = route.request().postDataJSON();
    
    // 1. Interview / Chat response
    if (url.includes(':generateContent') && !url.includes('models/gemini-3-flash-preview:generateContent?')) {
        // This is a bit simplified, but we can match based on systemInstruction in the payload if needed.
        // For now, assume it's the interview chat.
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                candidates: [{
                    content: {
                        parts: [{
                            text: JSON.stringify({
                                message: "I've gathered enough information. Would you like me to generate the form now?",
                                readyToScaffold: true
                            })
                        }]
                    },
                    finishReason: 'STOP'
                }]
            })
        });
        return;
    }

    // 2. Scaffold / Refine response
    if (url.includes(':generateContent') || url.includes(':generateContentStream')) {
        const mockForm = {
            title: "Mock Patient Intake Form",
            items: [
                { key: "full_name", type: "field", dataType: "string", label: "Full Name" },
                { key: "date_of_birth", type: "field", dataType: "date", label: "Date of Birth" }
            ]
        };

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                candidates: [{
                    content: {
                        parts: [{
                            text: JSON.stringify(mockForm)
                        }]
                    },
                    finishReason: 'STOP'
                }]
            })
        });
        return;
    }

    await route.continue();
  });
}
