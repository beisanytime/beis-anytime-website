document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Quiz Configuration ---
    const quizQuestions = [
        {
            question: "Set 1 year 13 Beis rebbe:",
            // The AI will check if the user's answer is semantically similar to this.
            // We provide a core, simple answer for the AI to compare against.
            correctAnswerSemantic: "Reb Yehoshua Hartman"
        },
        {
            question: "Rebbe who does dvar halocha:",
            correctAnswerSemantic: "Reb Yoni Rosenfeld"
        },
        {
            question: "What time do year 12 and 13 finish beis?",
            correctAnswerSemantic: "11:15"
        }
    ];

    // --- Placeholder for your actual API key ---
    // IMPORTANT: In a real application, this should NOT be stored directly in the code.
    // It should be handled securely, for example, through a backend service.
    const GEMINI_API_KEY = "AIzaSyB3lmQJddVZA9dvJrlXPJGyD-Mg-c6PH2Y"; // Replace with your actual key

    // --- 2. Check if Quiz Was Already Passed ---
    if (localStorage.getItem('quizPassed') === 'true') {
        return; // Don't show the quiz if it's already been passed
    }

    // --- 3. Hide the main page content ---
    document.body.classList.add('quiz-active');


    // --- 4. Create and Display the Quiz Modal ---
    function createQuizModal() {
        const backdrop = document.createElement('div');
        backdrop.id = 'quiz-modal-backdrop';

        const modal = document.createElement('div');
        modal.id = 'quiz-modal';

        let quizHTML = `
            <h2>Verification Required</h2>
            <p>Please answer the following questions to access the site.</p>
            <form id="quiz-form">
        `;

        quizQuestions.forEach((q, index) => {
            quizHTML += `
                <div class="quiz-question input-group">
                    <label for="question${index}">${index + 1}. ${q.question}</label>
                    <input type="text" id="question${index}" name="question${index}" required autocomplete="off">
                </div>
            `;
        });

        quizHTML += `
            <button type="submit" id="quiz-submit-button">Submit</button>
            <p id="quiz-status" class="quiz-status-message"></p>
            </form>
        `;
        modal.innerHTML = quizHTML;
        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);

        document.getElementById('quiz-form').addEventListener('submit', handleQuizSubmit);
    }

    // --- 5. Handle Quiz Submission ---
    async function handleQuizSubmit(event) {
        event.preventDefault();
        const form = event.target;
        const submitButton = document.getElementById('quiz-submit-button');
        const statusMessage = document.getElementById('quiz-status');

        submitButton.disabled = true;
        submitButton.textContent = 'Verifying...';
        statusMessage.textContent = '';
        statusMessage.style.color = '';

        const userAnswers = [];
        for (let i = 0; i < quizQuestions.length; i++) {
            userAnswers.push(form.querySelector(`input[name="question${i}"]`).value);
        }

        try {
            const results = await Promise.all(
                userAnswers.map((answer, index) =>
                    checkAnswerWithGemini(answer, quizQuestions[index].correctAnswerSemantic)
                )
            );

            const allCorrect = results.every(result => result === true);

            if (allCorrect) {
                statusMessage.textContent = 'Success! Accessing site...';
                statusMessage.style.color = '#28a745';
                localStorage.setItem('quizPassed', 'true');
                setTimeout(() => {
                    document.getElementById('quiz-modal-backdrop').remove();
                    document.body.classList.remove('quiz-active');
                }, 1000);
            } else {
                statusMessage.textContent = 'One or more answers are incorrect. Please try again.';
                statusMessage.style.color = 'red';
                submitButton.disabled = false;
                submitButton.textContent = 'Submit';
            }
        } catch (error) {
            console.error("API validation error:", error);
            statusMessage.textContent = 'Could not verify answers. Please check your connection and try again.';
            statusMessage.style.color = 'red';
            submitButton.disabled = false;
            submitButton.textContent = 'Submit';
        }
    }

    /**
     * --- 6. Simulate Gemini API Call to Check Answer ---
     * This function sends the user's answer and the correct answer to the AI
     * and asks it to determine if the user's answer is correct, allowing for variations.
     */
    async function checkAnswerWithGemini(userAnswer, correctAnswer) {
        // In a real scenario, you would not use a "lite" model for security checks,
        // but this is suitable for the prompt's request.
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

        const prompt = `
            You are a strict quiz validation assistant.
            The correct answer is: "${correctAnswer}".
            The user has provided the following answer: "${userAnswer}".

            Does the user's answer correctly identify the intended person or time?
            Be flexible with extra names (e.g., "Rabbi" or "Reb"), nicknames (e.g., "Yoni" for Yehonasan), misspellings of names, and extra spaces. The core information must be correct.

            Respond with only "true" if the answer is correct, or "false" if it is incorrect. Do not provide any other text or explanation.
        `;

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                }),
            });

            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }

            const data = await response.json();
            const resultText = data.candidates[0].content.parts[0].text.trim().toLowerCase();

            return resultText === 'true';

        } catch (error) {
            console.error('Error contacting Gemini API:', error);
            // Fallback for safety: if the API fails, deny access.
            return false;
        }
    }

    // --- Initialize the quiz ---
    createQuizModal();
});