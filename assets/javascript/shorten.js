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
    resultDiv.textContent = "Shortening URL with Spoo.me...";

    try {
        // Prepare form data
        const formData = new URLSearchParams();
        formData.append('url', viewerUrl);
        // Optional: add alias, password, max-clicks, block-bots
        // formData.append('alias', 'myalias');
        // formData.append('password', 'StrongPassword@123');
        // formData.append('max-clicks', '100');
        // formData.append('block-bots', 'false');

        const response = await fetch('https://spoo.me/', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData.toString()
        });

        const data = await response.json();

        if (data.short_url) {
            resultDiv.innerHTML = `Your short link: <a href="${data.short_url}" target="_blank">${data.short_url}</a>`;
        } else {
            resultDiv.textContent = "Failed to shorten the URL. Here is the full link: " + viewerUrl;
        }
    } catch (err) {
        console.error(err);
        resultDiv.textContent = "Error generating short link. Here is the full link: " + viewerUrl;
    }
});
