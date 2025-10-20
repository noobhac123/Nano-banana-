document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('generator-form');
    const promptInput = document.getElementById('prompt-input');
    const generateBtn = document.getElementById('generate-btn');
    const statusMessage = document.getElementById('status-message');
    const imageContainer = document.getElementById('image-container');
    const resultImage = document.getElementById('result-image');
    const creditsCountSpan = document.getElementById('credits-count');

    const updateCredits = async () => {
        try {
            const response = await fetch('/api/get-credits');
            if (!response.ok) {
                throw new Error('Could not fetch credits.');
            }
            const data = await response.json();
            const credits = data.remaining;
            creditsCountSpan.textContent = `${credits} / 5`;
            if (credits <= 0) {
                generateBtn.disabled = true;
                promptInput.disabled = true;
                promptInput.placeholder = 'You have no more credits today.';
            }
        } catch (error) {
            console.error('Error fetching credits:', error);
            creditsCountSpan.textContent = 'Error';
        }
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const prompt = promptInput.value.trim();
        if (!prompt) {
            setStatus('Please enter a prompt.', 'error');
            return;
        }

        disableForm();
        setStatus('Generating your image... this can take up to a minute.', 'loading');
        resultImage.style.display = 'none';

        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'An unknown error occurred.');
            }

            const data = await response.json();
            
            resultImage.src = `data:image/png;base64,${data.image}`;
            resultImage.style.display = 'block';
            setStatus(''); // Clear status message
            await updateCredits(); // Refresh credit count

        } catch (error) {
            console.error('Generation failed:', error);
            setStatus(`Error: ${error.message}`, 'error');
        } finally {
            // Re-enable the form only if credits still remain
            const currentCredits = parseInt(creditsCountSpan.textContent, 10);
            if (isNaN(currentCredits) || currentCredits > 0) {
                 generateBtn.disabled = false;
                 promptInput.disabled = false;
            }
        }
    });

    function setStatus(message, type = '') {
        statusMessage.textContent = message;
        statusMessage.className = ''; // Reset classes
        if (type) {
            statusMessage.classList.add(type);
        }
    }

    function disableForm() {
        generateBtn.disabled = true;
        promptInput.disabled = true;
    }

    // Initial call to get credits when the page loads
    updateCredits();
});