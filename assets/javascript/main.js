// Extract media URL from query parameters if present
function getMediaUrlFromParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const mediaUrl = urlParams.get('url') || urlParams.get('src');
    const stereoParam = urlParams.get('stereo');

    let stereoMode = 0; // Default: mono

    if (stereoParam) {
        const stereoLower = stereoParam.toLowerCase();
        switch (stereoLower) {
            case 'tb':
            case 'vertical':
            case '1':
                stereoMode = 1;
                break;
            case 'lr':
            case 'horizontal':
            case '2':
                stereoMode = 2;
                break;
            default:
                stereoMode = 0; // mono
        }
    }

    return {
        url: mediaUrl,
        stereoMode: stereoMode
    };
}

document.addEventListener('DOMContentLoaded', () => {
    /* ------------------ DOM references ------------------ */
    const elements = {
        dropArea: document.getElementById('dropArea'),
        fileInput: document.getElementById('fileInput'),
        selectButton: document.getElementById('selectButton'),
        aframeContainer: document.getElementById('aframeContainer'),
        controls: document.getElementById('controls'),
        resetButton: document.getElementById('resetButton'),
        stereoButton: document.getElementById('stereoButton'),
        videoControls: document.getElementById('videoControls'),
        playPauseButton: document.getElementById('playPauseButton'),
        videoSlider: document.getElementById('videoSlider'),
        loadingIndicator: document.getElementById('loadingIndicator'),
        zoomInfo: document.getElementById('zoomInfo'),
        screenshotButton: document.getElementById('screenshotButton'),
        screenshotFlash: document.getElementById('screenshotFlash'),
        screenshotFeedback: document.getElementById('screenshotFeedback'),
        globalDropOverlay: document.getElementById('globalDropOverlay'),
        container: document.getElementById('container')
    };

    // Check if required elements exist
    const requiredElements = ['dropArea', 'fileInput', 'selectButton', 'aframeContainer'];
    for (const elementName of requiredElements) {
        if (!elements[elementName]) {
            console.error(`Required element not found: ${elementName}`);
            return;
        }
    }

    /* ------------------ App state ------------------ */
    const state = {
        scene: null,
        videoElement: null,
        isPlaying: true,
        currentFov: 80,
        currentMedia: null,
        isMediaImage: false,
        stereoMode: 0,
        isDraggingFile: false
    };

    /* ------------------ Helpers ------------------ */
    const helpers = {
        showLoading: (flag) => {
            if (elements.loadingIndicator) {
                elements.loadingIndicator.style.display = flag ? 'flex' : 'none';
            }
        },

        updateFov: (delta) => {
            state.currentFov = Math.min(179, Math.max(1, state.currentFov + delta));
            const cam = document.querySelector('#mainCamera');
            if (cam) cam.setAttribute('camera', 'fov', state.currentFov);
            if (elements.zoomInfo) {
                elements.zoomInfo.textContent = `Zoom: ${Math.round(state.currentFov)}°`;
                elements.zoomInfo.style.background = 'rgba(66,133,244,0.7)';
                setTimeout(() => {
                    if (elements.zoomInfo) {
                        elements.zoomInfo.style.background = 'rgba(0,0,0,0.55)';
                    }
                }, 300);
            }
        },

        updatePlayPauseIcon: () => {
            if (elements.playPauseButton) {
                elements.playPauseButton.innerHTML = state.isPlaying ?
                    '<span class="material-symbols-outlined">pause</span>' :
                    '<span class="material-symbols-outlined">play_arrow</span>';
            }
        },

        preventDefaults: (e) => {
            e.preventDefault();
            e.stopPropagation();
        },

        updateStereoButton: () => {
            if (elements.stereoButton) {
                if (state.stereoMode > 0) {
                    elements.stereoButton.classList.add('active');
                } else {
                    elements.stereoButton.classList.remove('active');
                }
            }
        },

        updateSlider: () => {
            if (!state.videoElement || !state.videoElement.duration || !elements.videoSlider) return;
            const val = (state.videoElement.currentTime / state.videoElement.duration) * 100;
            elements.videoSlider.value = val;
        },

        dist: (t) => {
            return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
        },

        showGlobalDropOverlay: (show) => {
            if (elements.globalDropOverlay) {
                elements.globalDropOverlay.style.display = show ? 'flex' : 'none';
            }
        },

        safeStyleDisplay: (element, display) => {
            if (element) {
                element.style.display = display;
            }
        }
    };

    /* ------------------ Media handling ------------------ */
    const mediaHandlers = {
        processFile: (file) => {
            if (!file) {
                console.error('No file provided');
                return;
            }

            helpers.showLoading(true);
            state.currentFov = 80;
            if (elements.zoomInfo) elements.zoomInfo.textContent = 'Zoom: 80°';
            helpers.safeStyleDisplay(elements.videoControls, 'none');
            helpers.safeStyleDisplay(elements.stereoButton, 'none');
            state.stereoMode = 0;
            helpers.updateStereoButton();

            const reader = new FileReader();
            reader.onload = (e) => {
                const url = e.target.result;
                state.currentMedia = url;
                state.isMediaImage = file.type.startsWith('image/');
                if (state.isMediaImage) {
                    mediaHandlers.createImagePanorama(url);
                } else {
                    mediaHandlers.createVideoPanorama(url);
                }
            };
            reader.onerror = () => {
                helpers.showLoading(false);
                alert('Error reading file.');
            };
            reader.readAsDataURL(file);
        },

        processStereoImage: (src, callback) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    if (state.stereoMode === 1) { // Vertical (top/bottom)
                        canvas.width = img.width;
                        canvas.height = img.height / 2;
                        ctx.drawImage(img, 0, 0, img.width, img.height / 2, 0, 0, canvas.width, canvas.height);
                    } else if (state.stereoMode === 2) { // Horizontal (left/right)
                        canvas.width = img.width / 2;
                        canvas.height = img.height;
                        ctx.drawImage(img, 0, 0, img.width / 2, img.height, 0, 0, canvas.width, canvas.height);
                    } else {
                        // Non-stereo, use full image
                        canvas.width = img.width;
                        canvas.height = img.height;
                        ctx.drawImage(img, 0, 0);
                    }

                    callback(canvas.toDataURL('image/jpeg', 0.95));
                } catch (error) {
                    console.error('Error processing stereo image:', error);
                    helpers.showLoading(false);
                    alert('Error processing image.');
                }
            };
            img.onerror = () => {
                helpers.showLoading(false);
                alert('Error loading image.');
            };
            img.src = src;
        },

        createImagePanorama: (src) => {
            helpers.showLoading(true);

            mediaHandlers.processStereoImage(src, (processedSrc) => {
                interfaceHandlers.cleanupScene();

                try {
                    state.scene = document.createElement('a-scene');
                    state.scene.setAttribute('embedded', '');
                    state.scene.setAttribute('xr-mode-ui', 'enabled: true');

                    const sky = document.createElement('a-sky');
                    sky.setAttribute('src', processedSrc);
                    sky.setAttribute('rotation', '0 -90 0');

                    const camera = document.createElement('a-entity');
                    camera.setAttribute('camera', 'fov: 80');
                    camera.setAttribute('look-controls', 'reverseMouseDrag: true');
                    camera.setAttribute('wasd-controls', 'enabled: false');
                    camera.setAttribute('position', '0 1.6 0');
                    camera.setAttribute('id', 'mainCamera');

                    state.scene.appendChild(sky);
                    state.scene.appendChild(camera);
                    elements.aframeContainer.appendChild(state.scene);

                    sky.addEventListener('loaded', () => helpers.showLoading(false));
                    sky.addEventListener('error', () => {
                        helpers.showLoading(false);
                        alert('Error loading panorama image.');
                    });

                    elements.dropArea.classList.add('hidden');
                    helpers.safeStyleDisplay(elements.controls, 'flex');
                    helpers.safeStyleDisplay(elements.zoomInfo, 'block');
                    helpers.safeStyleDisplay(elements.stereoButton, 'block');
                    helpers.safeStyleDisplay(elements.resetButton, 'block');
                    helpers.safeStyleDisplay(elements.screenshotButton, 'block');
                } catch (error) {
                    console.error('Error creating image panorama:', error);
                    helpers.showLoading(false);
                    alert('Error creating panorama.');
                }
            });
        },

        createVideoPanorama: (src) => {
            interfaceHandlers.cleanupScene();

            try {
                state.scene = document.createElement('a-scene');
                state.scene.setAttribute('embedded', '');
                state.scene.setAttribute('xr-mode-ui', 'enabled: true');

                // Assets
                const assets = document.createElement('a-assets');
                state.scene.appendChild(assets);

                // Create video element
                state.videoElement = document.createElement('video');
                state.videoElement.id = 'videoAsset';
                state.videoElement.crossOrigin = "anonymous";

                // Autoplay-safe attributes BEFORE setting src
                state.videoElement.muted = true;
                state.videoElement.setAttribute('muted', '');
                state.videoElement.setAttribute('autoplay', '');
                state.videoElement.setAttribute('playsinline', '');
                state.videoElement.setAttribute('webkit-playsinline', '');
                state.videoElement.setAttribute('preload', 'auto');

                // Assign source
                state.videoElement.src = src;
                assets.appendChild(state.videoElement);

                // Videosphere
                const vidsphere = document.createElement('a-videosphere');
                vidsphere.setAttribute('src', '#videoAsset');
                vidsphere.setAttribute('rotation', '0 -90 0');
                state.scene.appendChild(vidsphere);

                // Camera
                const camera = document.createElement('a-entity');
                camera.setAttribute('camera', 'fov: 80');
                camera.setAttribute('look-controls', 'reverseMouseDrag: true');
                camera.setAttribute('wasd-controls', 'enabled: false');
                camera.setAttribute('position', '0 1.6 0');
                camera.setAttribute('id', 'mainCamera');
                state.scene.appendChild(camera);

                elements.aframeContainer.appendChild(state.scene);

                // UI state
                elements.dropArea.classList.add('hidden');
                helpers.safeStyleDisplay(elements.controls, 'flex');
                helpers.safeStyleDisplay(elements.videoControls, 'flex');
                helpers.safeStyleDisplay(elements.zoomInfo, 'block');
                helpers.safeStyleDisplay(elements.stereoButton, 'none');
                helpers.safeStyleDisplay(elements.resetButton, 'block');
                helpers.safeStyleDisplay(elements.screenshotButton, 'block');
                state.isPlaying = true;
                helpers.updatePlayPauseIcon();

                // Event handlers
                const onReady = () => {
                    helpers.showLoading(false);
                    if (elements.videoSlider) elements.videoSlider.value = 0;
                    state.videoElement.play().catch(err => console.warn("Autoplay blocked:", err));
                    state.videoElement.removeEventListener('canplay', onReady);
                    state.videoElement.removeEventListener('loadedmetadata', onReady);
                };
                
                const onError = () => {
                    helpers.showLoading(false);
                    console.error("VIDEO ERROR:", state.videoElement.error);
                    alert("This video cannot be played. It may use an unsupported codec (try H.264/AAC).");
                };

                state.videoElement.addEventListener('loadedmetadata', onReady);
                state.videoElement.addEventListener('canplay', onReady);
                state.videoElement.addEventListener('error', onError);
                state.videoElement.addEventListener('timeupdate', helpers.updateSlider);

                // Autoplay unlock on user click (fallback)
                const unlockPlay = () => {
                    if (state.videoElement && state.videoElement.paused) {
                        state.videoElement.play().catch(err => console.warn("Play blocked:", err));
                    }
                    document.removeEventListener('click', unlockPlay);
                };
                document.addEventListener('click', unlockPlay, { once: true });

            } catch (error) {
                console.error('Error creating video panorama:', error);
                helpers.showLoading(false);
                alert('Error creating video panorama.');
            }
        },

        loadMediaFromUrl: (url, initialStereoMode = 0) => {
            if (!url) {
                console.error('No URL provided');
                return;
            }

            helpers.showLoading(true);
            state.stereoMode = initialStereoMode;
            helpers.updateStereoButton();

            const lowerUrl = url.toLowerCase();
            const videoExtensions = ['.mp4', '.webm'];
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];

            if (videoExtensions.some(ext => lowerUrl.includes(ext))) {
                // It's a video
                state.currentMedia = url;
                state.isMediaImage = false;
                state.stereoMode = 0; // Stereo not supported for videos
                mediaHandlers.createVideoPanorama(url);
            } else if (imageExtensions.some(ext => lowerUrl.includes(ext))) {
                // It's an image
                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.onload = () => {
                    state.currentMedia = url;
                    state.isMediaImage = true;
                    mediaHandlers.createImagePanorama(url);
                };
                img.onerror = () => {
                    helpers.showLoading(false);
                    alert('Unsupported media type or inaccessible URL');
                };
                img.src = url;
            } else {
                // Fallback: try loading as image first, then video
                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.onload = () => {
                    state.currentMedia = url;
                    state.isMediaImage = true;
                    mediaHandlers.createImagePanorama(url);
                };
                img.onerror = () => {
                    // Try video element as fallback
                    const testVideo = document.createElement('video');
                    testVideo.onloadedmetadata = () => {
                        state.currentMedia = url;
                        state.isMediaImage = false;
                        mediaHandlers.createVideoPanorama(url);
                        testVideo.remove();
                    };
                    testVideo.onerror = () => {
                        helpers.showLoading(false);
                        alert('Unable to load media from the provided URL.');
                        testVideo.remove();
                    };
                    testVideo.src = url;
                };
                img.src = url;
            }
        }
    };

    /* ------------------ Interface handlers ------------------ */
    const interfaceHandlers = {
        takeScreenshot: () => {
            if (!state.scene) return;

            // Temporarily hide UI elements
            const elementsToHide = [
                elements.zoomInfo,
                elements.controls,
                elements.stereoButton
            ].filter(Boolean); // Remove null elements

            // Store original display states
            const originalDisplays = elementsToHide.map(el => el.style.display);

            // Hide elements
            elementsToHide.forEach(el => el.style.display = 'none');

            // Let the render update (wait for next frame)
            requestAnimationFrame(() => {
                // Take screenshot of canvas
                const canvas = document.querySelector('canvas');
                if (!canvas) {
                    // Restore UI and return
                    elementsToHide.forEach((el, i) => el.style.display = originalDisplays[i]);
                    return;
                }

                try {
                    // Create screenshot
                    const dataURL = canvas.toDataURL('image/png');

                    // Create download link
                    const downloadLink = document.createElement('a');
                    downloadLink.href = dataURL;
                    downloadLink.download = 'panorama-screenshot.png';

                    // Trigger download
                    document.body.appendChild(downloadLink);
                    downloadLink.click();
                    document.body.removeChild(downloadLink);

                    // Show flash effect
                    if (elements.screenshotFlash) {
                        elements.screenshotFlash.style.opacity = '0.7';
                        setTimeout(() => {
                            if (elements.screenshotFlash) {
                                elements.screenshotFlash.style.opacity = '0';
                            }
                        }, 100);
                    }

                    // Show feedback
                    if (elements.screenshotFeedback) {
                        elements.screenshotFeedback.style.opacity = '1';
                        setTimeout(() => {
                            if (elements.screenshotFeedback) {
                                elements.screenshotFeedback.style.opacity = '0';
                            }
                        }, 2000);
                    }
                } catch (error) {
                    console.error('Error taking screenshot:', error);
                    alert('Error taking screenshot.');
                }

                // Restore UI
                setTimeout(() => {
                    elementsToHide.forEach((el, i) => el.style.display = originalDisplays[i]);
                }, 300);
            });
        },

        cleanupScene: () => {
            try {
                if (state.scene && elements.aframeContainer.contains(state.scene)) {
                    elements.aframeContainer.removeChild(state.scene);
                }
                state.scene = null;
                
                if (state.videoElement) {
                    state.videoElement.pause();
                    state.videoElement = null;
                }
                
                helpers.safeStyleDisplay(elements.controls, 'none');
                helpers.safeStyleDisplay(elements.videoControls, 'none');
                helpers.safeStyleDisplay(elements.zoomInfo, 'none');
                helpers.safeStyleDisplay(elements.stereoButton, 'none');
                helpers.safeStyleDisplay(elements.resetButton, 'none');
                helpers.safeStyleDisplay(elements.screenshotButton, 'none');
                elements.dropArea.classList.remove('hidden');
                if (elements.fileInput) elements.fileInput.value = '';
            } catch (error) {
                console.error('Error during cleanup:', error);
            }
        }
    };

    /* ------------------ Event Listeners ------------------ */
    // File input and drop area
    if (elements.selectButton && elements.fileInput) {
        elements.selectButton.addEventListener('click', () => elements.fileInput.click());
        elements.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) mediaHandlers.processFile(e.target.files[0]);
        });
    }

    // Drag and drop events for initial drop area
    if (elements.dropArea) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
            elements.dropArea.addEventListener(evt, helpers.preventDefaults);
        });

        ['dragenter', 'dragover'].forEach(evt => {
            elements.dropArea.addEventListener(evt, () => {
                elements.dropArea.style.borderColor = '#4285f4';
                elements.dropArea.style.background = '#e8f0fe';
            });
        });

        ['dragleave', 'drop'].forEach(evt => {
            elements.dropArea.addEventListener(evt, () => {
                elements.dropArea.style.borderColor = '#ccc';
                elements.dropArea.style.background = '#f5f5f5';
            });
        });

        elements.dropArea.addEventListener('drop', (e) => {
            const f = e.dataTransfer.files[0];
            if (!f) return;
            const valid = /^image\/|video\/(mp4|webm)/.test(f.type);
            if (valid) {
                mediaHandlers.processFile(f);
            } else {
                alert('Please upload an image or MP4/WebM video file.');
            }
        });
    }

    // Global drag and drop events
    document.addEventListener('dragenter', (e) => {
        helpers.preventDefaults(e);
        if (state.scene && !state.isDraggingFile && e.dataTransfer && e.dataTransfer.types.includes('Files')) {
            state.isDraggingFile = true;
            helpers.showGlobalDropOverlay(true);
        }
    });

    document.addEventListener('dragover', (e) => {
        helpers.preventDefaults(e);
        if (state.isDraggingFile && e.dataTransfer && e.dataTransfer.types.includes('Files')) {
            helpers.showGlobalDropOverlay(true);
        }
    });

    document.addEventListener('dragleave', (e) => {
        helpers.preventDefaults(e);
        if (e.clientX <= 0 || e.clientX >= window.innerWidth ||
            e.clientY <= 0 || e.clientY >= window.innerHeight) {
            state.isDraggingFile = false;
            helpers.showGlobalDropOverlay(false);
        }
    });

    document.addEventListener('drop', (e) => {
        helpers.preventDefaults(e);
        helpers.showGlobalDropOverlay(false);
        state.isDraggingFile = false;

        const f = e.dataTransfer.files[0];
        if (!f) return;

        const valid = /^image\/|video\/(mp4|webm)/.test(f.type);
        if (valid) {
            mediaHandlers.processFile(f);
        } else {
            alert('Please upload an image or MP4/WebM video file.');
        }
    });

    // Video controls
    if (elements.videoSlider) {
        elements.videoSlider.addEventListener('input', () => {
            if (!state.videoElement || !state.videoElement.duration) return;
            const newTime = (elements.videoSlider.value / 100) * state.videoElement.duration;
            state.videoElement.currentTime = newTime;
            if (!state.isPlaying) {
                state.videoElement.pause();
            }
        });
    }

    if (elements.playPauseButton) {
        elements.playPauseButton.addEventListener('click', () => {
            if (!state.videoElement) return;
            if (state.isPlaying) {
                state.videoElement.pause();
            } else {
                state.videoElement.play().catch(() => {});
            }
            state.isPlaying = !state.isPlaying;
            helpers.updatePlayPauseIcon();
        });
    }

    // Screenshot functionality
    if (elements.screenshotButton) {
        elements.screenshotButton.addEventListener('click', interfaceHandlers.takeScreenshot);
    }

    // Reset button
    if (elements.resetButton) {
        elements.resetButton.addEventListener('click', interfaceHandlers.cleanupScene);
    }

    // Stereo toggle
    if (elements.stereoButton) {
        elements.stereoButton.addEventListener('click', () => {
            if (!state.currentMedia) return;

            // Cycle through stereo modes: Off -> Vertical -> Horizontal -> Off
            state.stereoMode = (state.stereoMode + 1) % 3;
            helpers.updateStereoButton();

            // Reload the panorama with the new stereo mode
            if (state.isMediaImage) {
                mediaHandlers.createImagePanorama(state.currentMedia);
            }
        });
    }

    // Zoom handlers
    document.addEventListener('wheel', (e) => {
        if (!state.scene) return;
        helpers.updateFov(Math.sign(e.deltaY) * 2);
        e.preventDefault();
    }, { passive: false });

    // Pinch-to-zoom on laptop track pads and mobile devices
    let pinchStartDist = 0;
    document.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) pinchStartDist = helpers.dist(e.touches);
    });

    document.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && state.scene) {
            const d = helpers.dist(e.touches);
            if (Math.abs(d - pinchStartDist) > 5) {
                helpers.updateFov((pinchStartDist - d) > 0 ? 1 : -1);
                pinchStartDist = d;
            }
            e.preventDefault();
        }
    }, { passive: false });

    // Remove default click & drag feature
    document.addEventListener('dragstart', (e) => {
        if (e.target.tagName === 'CANVAS' || e.target.closest('a-scene')) {
            e.preventDefault();
            return false;
        }
    });

    // Check for URL parameter and load media if present
    try {
        const mediaParams = getMediaUrlFromParams();
        if (mediaParams.url) {
            mediaHandlers.loadMediaFromUrl(mediaParams.url, mediaParams.stereoMode);
        }
    } catch (error) {
        console.error('Error loading media from URL parameters:', error);
    }
});