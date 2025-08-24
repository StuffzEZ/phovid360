        const generateBtn = document.getElementById('generateBtn');
        const resultDiv = document.getElementById('result');

        generateBtn.addEventListener('click', async () => {
            const videoUrl = document.getElementById('videoUrl').value.trim();
            if (!videoUrl) {
                alert("Please enter a video URL.");
                return;
            }

            // Create the full viewer URL
            const viewerUrl = `https://stuffzez.github.io/PhoVid360/viewer?url=${encodeURIComponent(videoUrl)}`;
            resultDiv.textContent = "Shortening URL...";

            try {
                const response = await fetch('https://ulvis.net/api/v1/shorten', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: viewerUrl })
                });

                const data = await response.json();
                if (data.shortUrl) {
                    resultDiv.innerHTML = `Your short link: <a href="${data.shortUrl}" target="_blank">${data.shortUrl}</a>`;
                } else {
                    resultDiv.textContent = "Failed to shorten the URL. Here is the full link: " + viewerUrl;
                }
            } catch (err) {
                console.error(err);
                resultDiv.textContent = "Error generating short link. Here is the full link: " + viewerUrl;
            }
        });