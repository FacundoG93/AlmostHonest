// =====================================================================
// DOM Elements
// =====================================================================
const paper = document.getElementById('paper');
const paperFrame = document.getElementById('paperFrame');
const vignette = document.getElementById('vignette');
const letterBody = document.getElementById('letterBody');
const letterDate = document.getElementById('letterDate');
const letterGreeting = document.getElementById('letterGreeting');
const signatureLabel = document.querySelector('.sig-label');
const signatureName = document.querySelector('.sig-name');
const header = document.getElementById('letterHeader');
const signature = document.getElementById('letterSignature');
const linesBtn = document.getElementById('linesBtn');
const modeBtn = document.getElementById('modeBtn');
const inkSelect = document.getElementById('inkSelect');
const sizeDisplay = document.getElementById('sizeDisplay');
const stickerLayer = document.getElementById('stickerLayer');

// State
let linesOn = false;
let letterMode = true;
let currentFontSize = 15;
let currentEffect = 'none';
let selectedSticker = null;
let aspectRatioLocked = true;
let currentAspectRatio = 1;

// Sticker control elements
const stickerWidthInput = document.getElementById('stickerWidth');
const stickerHeightInput = document.getElementById('stickerHeight');
const lockAspectBtn = document.getElementById('lockAspectBtn');
const mirrorXBtn = document.getElementById('mirrorXBtn');
const mirrorYBtn = document.getElementById('mirrorYBtn');

// Toolbar sections to show/hide
const stickerToolbarSection = document.querySelector('.toolbar-section:has(#stickerWidth)');
const rotateToolbarSection = document.querySelector('.toolbar-section:has(#rotateLeft)');

// =====================================================================
// Sticker Helper Functions (Rotate, Resize, Drag, Scale)
// =====================================================================

// Get current rotation
function getStickerRotation(sticker) {
    const transform = sticker.style.transform;
    if (!transform || transform === 'none') return 0;
    const match = transform.match(/rotate\(([^)]+)\)/);
    if (match && match[1]) {
        return parseFloat(match[1]);
    }
    return 0;
}

// Get sticker scale
function getStickerScale(sticker) {
    let scaleX = 1, scaleY = 1;
    const transform = sticker.style.transform;
    
    if (transform && transform !== 'none') {
        const scaleMatch = transform.match(/scale\(([^,]+),?\s*([^)]+)?\)/);
        if (scaleMatch) {
            scaleX = parseFloat(scaleMatch[1]);
            scaleY = scaleMatch[2] ? parseFloat(scaleMatch[2]) : scaleX;
        }
        
        const scaleXMatch = transform.match(/scaleX\(([^)]+)\)/);
        const scaleYMatch = transform.match(/scaleY\(([^)]+)\)/);
        if (scaleXMatch) scaleX = parseFloat(scaleXMatch[1]);
        if (scaleYMatch) scaleY = parseFloat(scaleYMatch[1]);
    }
    
    return { scaleX, scaleY };
}

// Set sticker rotation (preserving scale)
function setStickerRotation(sticker, degrees) {
    let currentScaleX = 1, currentScaleY = 1;
    const transform = sticker.style.transform;
    
    if (transform && transform !== 'none') {
        const scaleMatch = transform.match(/scale\(([^,]+),?\s*([^)]+)?\)/);
        if (scaleMatch) {
            currentScaleX = parseFloat(scaleMatch[1]);
            currentScaleY = scaleMatch[2] ? parseFloat(scaleMatch[2]) : currentScaleX;
        }
        
        const scaleXMatch = transform.match(/scaleX\(([^)]+)\)/);
        const scaleYMatch = transform.match(/scaleY\(([^)]+)\)/);
        if (scaleXMatch) currentScaleX = parseFloat(scaleXMatch[1]);
        if (scaleYMatch) currentScaleY = parseFloat(scaleYMatch[1]);
    }
    
    let newTransform = '';
    if (degrees !== 0) newTransform += `rotate(${degrees}deg) `;
    if (currentScaleX !== 1 || currentScaleY !== 1) {
        newTransform += `scale(${currentScaleX}, ${currentScaleY})`;
    }
    
    sticker.style.transform = newTransform || 'none';
    
    if (sticker === selectedSticker) {
        updateStickerSizeInputs();
    }
}

// Set sticker scale
function setStickerScale(sticker, scaleX, scaleY) {
    let rotation = getStickerRotation(sticker);
    let newTransform = '';
    if (rotation !== 0) newTransform += `rotate(${rotation}deg) `;
    if (scaleX !== 1 || scaleY !== 1) {
        newTransform += `scale(${scaleX}, ${scaleY})`;
    }
    sticker.style.transform = newTransform || 'none';
    
    if (sticker === selectedSticker) {
        updateStickerSizeInputs();
    }
}

// Helper function to get image dimensions
function getImageDimensions(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            resolve({ width: img.width, height: img.height });
        };
        img.onerror = reject;
        img.src = url;
    });
}

// Make sticker rotatable
function makeStickerRotatable(sticker) {
    let isRotating = false;
    let startX, startY, startRotation, centerX, centerY;
    
    const rotateHandle = document.createElement('div');
    rotateHandle.className = 'rotate-handle';
    sticker.appendChild(rotateHandle);
    
    rotateHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        isRotating = true;
        
        const rect = sticker.getBoundingClientRect();
        centerX = rect.left + rect.width / 2;
        centerY = rect.top + rect.height / 2;
        
        startX = e.clientX;
        startY = e.clientY;
        startRotation = getStickerRotation(sticker);
        
        const onMouseMove = (moveEvent) => {
            if (!isRotating) return;
            
            const angle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX);
            const startAngle = Math.atan2(startY - centerY, startX - centerX);
            
            let rotation = startRotation + (angle - startAngle) * (180 / Math.PI);
            rotation = rotation % 360;
            if (rotation < 0) rotation += 360;
            
            setStickerRotation(sticker, rotation);
            moveEvent.preventDefault();
        };
        
        const onMouseUp = () => {
            isRotating = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            if (sticker === selectedSticker) updateStickerSizeInputs();
        };
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        e.preventDefault();
    });
}

// Make sticker resizable
function makeStickerResizable(sticker, isEmoji = true) {
    let isResizing = false;
    let startX, startY, startWidth, startHeight;
    
    const handle = document.createElement('div');
    handle.className = 'resize-handle';
    sticker.appendChild(handle);
    
    handle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = sticker.offsetWidth;
        startHeight = sticker.offsetHeight;
        
        const onMouseMove = (moveEvent) => {
            if (!isResizing) return;
            
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;
            let newWidth = Math.max(30, startWidth + dx);
            let newHeight = Math.max(30, startHeight + dy);
            
            if (aspectRatioLocked && sticker === selectedSticker && !isEmoji) {
                newHeight = newWidth / currentAspectRatio;
                sticker.classList.remove('stretched');
                const img = sticker.querySelector('img');
                if (img) img.style.objectFit = 'contain';
            } else if (!isEmoji) {
                sticker.classList.add('stretched');
                const img = sticker.querySelector('img');
                if (img) img.style.objectFit = 'fill';
            }
            
            sticker.style.width = newWidth + 'px';
            sticker.style.height = newHeight + 'px';
            
            if (isEmoji) {
                const fontSize = Math.max(20, newWidth * 0.6);
                sticker.style.fontSize = fontSize + 'px';
            }
            
            if (sticker === selectedSticker) {
                stickerWidthInput.value = Math.round(newWidth);
                stickerHeightInput.value = Math.round(newHeight);
                if (aspectRatioLocked) {
                    currentAspectRatio = newWidth / newHeight;
                }
            }
            
            moveEvent.preventDefault();
        };
        
        const onMouseUp = () => {
            isResizing = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            if (sticker === selectedSticker) updateStickerSizeInputs();
        };
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        e.preventDefault();
    });
}

// Make sticker draggable
function makeStickerDraggable(sticker) {
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    
    sticker.addEventListener('mousedown', (e) => {
        if (e.target.classList && (e.target.classList.contains('resize-handle') || e.target.classList.contains('rotate-handle'))) return;
        
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = parseFloat(sticker.style.left);
        startTop = parseFloat(sticker.style.top);
        sticker.style.cursor = 'grabbing';
        e.preventDefault();
        e.stopPropagation();
    });
    
    const onMouseMove = (e) => {
        if (!isDragging) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        let newLeft = startLeft + dx;
        let newTop = startTop + dy;
        
        sticker.style.left = newLeft + 'px';
        sticker.style.top = newTop + 'px';
    };
    
    const onMouseUp = () => {
        isDragging = false;
        sticker.style.cursor = 'grab';
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

// =====================================================================
// Sticker Creation Functions
// =====================================================================

// Add emoji sticker
function addSticker(emoji) {
    const sticker = document.createElement('div');
    sticker.className = 'sticker sticker-emoji';
    sticker.textContent = emoji;
    sticker.style.left = (50 + Math.random() * 450) + 'px';
    sticker.style.top = (80 + Math.random() * 650) + 'px';
    sticker.style.width = '80px';
    sticker.style.height = '80px';
    sticker.style.fontSize = '60px';
    
    makeStickerRotatable(sticker);
    makeStickerResizable(sticker, true);
    makeStickerDraggable(sticker);
    
    sticker.addEventListener('dblclick', () => sticker.remove());
    stickerLayer.appendChild(sticker);
}

// Add user-uploaded image sticker
async function addImageSticker(imageUrl) {
    try {
        const dimensions = await getImageDimensions(imageUrl);
        let initialWidth = dimensions.width;
        let initialHeight = dimensions.height;
        const maxSize = 300;
        
        if (initialWidth > maxSize || initialHeight > maxSize) {
            const scale = maxSize / Math.max(initialWidth, initialHeight);
            initialWidth = initialWidth * scale;
            initialHeight = initialHeight * scale;
        }
        
        const sticker = document.createElement('div');
        sticker.className = 'sticker';
        sticker.style.left = (50 + Math.random() * 450) + 'px';
        sticker.style.top = (80 + Math.random() * 650) + 'px';
        sticker.style.width = initialWidth + 'px';
        sticker.style.height = initialHeight + 'px';
        
        sticker.dataset.nativeWidth = dimensions.width;
        sticker.dataset.nativeHeight = dimensions.height;
        sticker.dataset.nativeRatio = dimensions.width / dimensions.height;
        
        const img = document.createElement('img');
        img.src = imageUrl;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        img.style.pointerEvents = 'none';
        sticker.appendChild(img);
        
        makeStickerRotatable(sticker);
        makeStickerResizable(sticker, false);
        makeStickerDraggable(sticker);
        
        sticker.addEventListener('dblclick', () => sticker.remove());
        stickerLayer.appendChild(sticker);
        
        if (sticker === selectedSticker) {
            currentAspectRatio = dimensions.width / dimensions.height;
        }
    } catch (error) {
        console.error('Error loading image:', error);
    }
}

// Pre-loaded image stickers database
const imageStickers = {
    Carnation1: { url: 'preset/Carnation1.png', name: 'Carnation 1', defaultSize: 100 },
    Carnation2: { url: 'preset/Carnation2.png', name: 'Carnation 2', defaultSize: 100 },
    Carnation3: { url: 'preset/Carnation3.png', name: 'Carnation 3', defaultSize: 100 },
    Carnation4: { url: 'preset/Carnation4.png', name: 'Carnation 4', defaultSize: 100 },
    Line1: { url: 'preset/Line1.png', name: 'Line 1', defaultSize: 100 },
    Line2: { url: 'preset/Line2.png', name: 'Line 2', defaultSize: 100 }
};

// Add pre-loaded image sticker
async function addPreLoadedImageSticker(imageKey) {
    const imageData = imageStickers[imageKey];
    if (!imageData) {
        console.error('Image not found:', imageKey);
        return;
    }
    
    try {
        const dimensions = await getImageDimensions(imageData.url);
        let initialWidth = dimensions.width;
        let initialHeight = dimensions.height;
        const maxSize = 200;
        
        if (initialWidth > maxSize || initialHeight > maxSize) {
            const scale = maxSize / Math.max(initialWidth, initialHeight);
            initialWidth = initialWidth * scale;
            initialHeight = initialHeight * scale;
        }
        
        const sticker = document.createElement('div');
        sticker.className = 'sticker';
        sticker.style.left = (50 + Math.random() * 450) + 'px';
        sticker.style.top = (80 + Math.random() * 650) + 'px';
        sticker.style.width = initialWidth + 'px';
        sticker.style.height = initialHeight + 'px';
        
        sticker.dataset.nativeWidth = dimensions.width;
        sticker.dataset.nativeHeight = dimensions.height;
        sticker.dataset.nativeRatio = dimensions.width / dimensions.height;
        
        const img = document.createElement('img');
        img.src = imageData.url;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        img.style.pointerEvents = 'none';
        img.alt = imageData.name;
        
        img.onerror = () => {
            console.error('Failed to load image:', imageData.url);
            sticker.textContent = '❌';
            sticker.style.fontSize = '40px';
            sticker.style.display = 'flex';
            sticker.style.alignItems = 'center';
            sticker.style.justifyContent = 'center';
        };
        
        sticker.appendChild(img);
        
        makeStickerRotatable(sticker);
        makeStickerResizable(sticker, false);
        makeStickerDraggable(sticker);
        
        sticker.addEventListener('dblclick', () => sticker.remove());
        stickerLayer.appendChild(sticker);
        
        if (sticker === selectedSticker) {
            currentAspectRatio = dimensions.width / dimensions.height;
        }
    } catch (error) {
        console.error('Error loading image:', error);
    }
}

// =====================================================================
// Toolbar Visibility Control
// =====================================================================

function showStickerToolbars() {
    if (stickerToolbarSection) stickerToolbarSection.style.display = 'flex';
    if (rotateToolbarSection) rotateToolbarSection.style.display = 'flex';
}

function hideStickerToolbars() {
    if (stickerToolbarSection) stickerToolbarSection.style.display = 'none';
    if (rotateToolbarSection) rotateToolbarSection.style.display = 'none';
}

// Initially hide toolbars
hideStickerToolbars();

// =====================================================================
// Sticker Selection & UI Updates
// =====================================================================

function updateStickerSizeInputs() {
    if (selectedSticker) {
        const width = Math.round(selectedSticker.offsetWidth);
        const height = Math.round(selectedSticker.offsetHeight);
        stickerWidthInput.value = width;
        stickerHeightInput.value = height;
        
        if (selectedSticker.dataset.nativeRatio) {
            currentAspectRatio = parseFloat(selectedSticker.dataset.nativeRatio);
        } else if (width > 0 && height > 0 && aspectRatioLocked) {
            currentAspectRatio = width / height;
        }
        
        if (aspectRatioLocked) {
            selectedSticker.classList.remove('stretched');
            const img = selectedSticker.querySelector('img');
            if (img) img.style.objectFit = 'contain';
        } else {
            selectedSticker.classList.add('stretched');
            const img = selectedSticker.querySelector('img');
            if (img) img.style.objectFit = 'fill';
        }
    }
}

function updateLockButtonState() {
    if (aspectRatioLocked) {
        lockAspectBtn.textContent = '🔒';
        lockAspectBtn.classList.add('locked');
    } else {
        lockAspectBtn.textContent = '🔓';
        lockAspectBtn.classList.remove('locked');
    }
}

// Sticker selection handler
document.addEventListener('click', (e) => {
    const sticker = e.target.closest('.sticker');
    const isToolbarButton = e.target.closest('.tb-btn') || e.target.closest('.export-btn') || e.target.closest('.frame-opt') || e.target.closest('.font-opt');
    const isPanel = e.target.closest('.side-panel');
    const isInput = e.target.matches('#stickerWidth') || e.target.matches('#stickerHeight');
    
    if (isInput) {
        return;
    }
    
    if (sticker) {
        if (selectedSticker && selectedSticker !== sticker) {
            selectedSticker.classList.remove('selected');
        }
        selectedSticker = sticker;
        selectedSticker.classList.add('selected');
        updateStickerSizeInputs();
        updateLockButtonState();
        showStickerToolbars();
    } else if (isToolbarButton || isPanel) {
        if (selectedSticker) {
            selectedSticker.classList.add('selected');
            showStickerToolbars();
        }
    } else if (selectedSticker) {
        selectedSticker.classList.remove('selected');
        selectedSticker = null;
        stickerWidthInput.value = '';
        stickerHeightInput.value = '';
        hideStickerToolbars();
    }
});

// =====================================================================
// Sticker Control Handlers (Width, Height, Lock, Mirror)
// =====================================================================

stickerWidthInput.addEventListener('mousedown', (e) => {
    e.stopPropagation();
});

stickerWidthInput.addEventListener('input', (e) => {
    e.stopPropagation();
    if (!selectedSticker) return;
    
    let newWidth = parseInt(stickerWidthInput.value);
    if (isNaN(newWidth)) return;
    newWidth = Math.max(10, Math.min(800, newWidth));
    
    if (aspectRatioLocked) {
        let newHeight = Math.round(newWidth / currentAspectRatio);
        newHeight = Math.max(10, Math.min(800, newHeight));
        selectedSticker.style.height = newHeight + 'px';
        stickerHeightInput.value = newHeight;
        selectedSticker.classList.remove('stretched');
        const img = selectedSticker.querySelector('img');
        if (img) img.style.objectFit = 'contain';
    } else {
        selectedSticker.classList.add('stretched');
        const img = selectedSticker.querySelector('img');
        if (img) img.style.objectFit = 'fill';
    }
    
    selectedSticker.style.width = newWidth + 'px';
    
    if (selectedSticker.classList.contains('sticker-emoji')) {
        const fontSize = Math.max(20, newWidth * 0.6);
        selectedSticker.style.fontSize = fontSize + 'px';
    }
    
    if (aspectRatioLocked) {
        currentAspectRatio = newWidth / selectedSticker.offsetHeight;
    }
    
    selectedSticker.classList.add('selected');
});

stickerWidthInput.addEventListener('change', (e) => {
    e.stopPropagation();
    if (!selectedSticker) return;
    let newWidth = parseInt(stickerWidthInput.value);
    if (isNaN(newWidth)) newWidth = selectedSticker.offsetWidth;
    newWidth = Math.max(10, Math.min(800, newWidth));
    selectedSticker.style.width = newWidth + 'px';
    stickerWidthInput.value = newWidth;
    selectedSticker.classList.add('selected');
});

stickerHeightInput.addEventListener('mousedown', (e) => {
    e.stopPropagation();
});

stickerHeightInput.addEventListener('input', (e) => {
    e.stopPropagation();
    if (!selectedSticker) return;
    
    let newHeight = parseInt(stickerHeightInput.value);
    if (isNaN(newHeight)) return;
    newHeight = Math.max(10, Math.min(800, newHeight));
    
    if (aspectRatioLocked) {
        let newWidth = Math.round(newHeight * currentAspectRatio);
        newWidth = Math.max(10, Math.min(800, newWidth));
        selectedSticker.style.width = newWidth + 'px';
        stickerWidthInput.value = newWidth;
        selectedSticker.classList.remove('stretched');
        const img = selectedSticker.querySelector('img');
        if (img) img.style.objectFit = 'contain';
        
        if (selectedSticker.classList.contains('sticker-emoji')) {
            const fontSize = Math.max(20, newWidth * 0.6);
            selectedSticker.style.fontSize = fontSize + 'px';
        }
    } else {
        selectedSticker.classList.add('stretched');
        const img = selectedSticker.querySelector('img');
        if (img) img.style.objectFit = 'fill';
    }
    
    selectedSticker.style.height = newHeight + 'px';
    
    if (aspectRatioLocked) {
        currentAspectRatio = selectedSticker.offsetWidth / newHeight;
    }
    
    selectedSticker.classList.add('selected');
});

stickerHeightInput.addEventListener('change', (e) => {
    e.stopPropagation();
    if (!selectedSticker) return;
    let newHeight = parseInt(stickerHeightInput.value);
    if (isNaN(newHeight)) newHeight = selectedSticker.offsetHeight;
    newHeight = Math.max(10, Math.min(800, newHeight));
    selectedSticker.style.height = newHeight + 'px';
    stickerHeightInput.value = newHeight;
    selectedSticker.classList.add('selected');
});

lockAspectBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    aspectRatioLocked = !aspectRatioLocked;
    updateLockButtonState();
    
    if (aspectRatioLocked && selectedSticker) {
        const width = selectedSticker.offsetWidth;
        const height = selectedSticker.offsetHeight;
        if (width > 0 && height > 0) {
            currentAspectRatio = width / height;
        }
        stickerWidthInput.value = Math.round(width);
        stickerHeightInput.value = Math.round(height);
        selectedSticker.classList.remove('stretched');
        const img = selectedSticker.querySelector('img');
        if (img) img.style.objectFit = 'contain';
    } else if (selectedSticker) {
        selectedSticker.classList.add('stretched');
        const img = selectedSticker.querySelector('img');
        if (img) img.style.objectFit = 'fill';
    }
    
    if (selectedSticker) {
        selectedSticker.classList.add('selected');
    }
});

mirrorXBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!selectedSticker) return;
    const { scaleX, scaleY } = getStickerScale(selectedSticker);
    setStickerScale(selectedSticker, -scaleX, scaleY);
    selectedSticker.classList.add('selected');
});

mirrorYBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!selectedSticker) return;
    const { scaleX, scaleY } = getStickerScale(selectedSticker);
    setStickerScale(selectedSticker, scaleX, -scaleY);
    selectedSticker.classList.add('selected');
});

// =====================================================================
// Rotation Buttons & Keyboard Shortcuts
// =====================================================================

document.getElementById('rotateLeft')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (selectedSticker) {
        const currentRotation = getStickerRotation(selectedSticker);
        setStickerRotation(selectedSticker, currentRotation - 15);
        selectedSticker.classList.add('selected');
        showStickerToolbars();
    }
});

document.getElementById('rotateRight')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (selectedSticker) {
        const currentRotation = getStickerRotation(selectedSticker);
        setStickerRotation(selectedSticker, currentRotation + 15);
        selectedSticker.classList.add('selected');
        showStickerToolbars();
    }
});

document.getElementById('resetRotation')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (selectedSticker) {
        setStickerRotation(selectedSticker, 0);
        selectedSticker.classList.add('selected');
        showStickerToolbars();
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (!selectedSticker) return;
    
    if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const currentRotation = getStickerRotation(selectedSticker);
        setStickerRotation(selectedSticker, currentRotation - 15);
    } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const currentRotation = getStickerRotation(selectedSticker);
        setStickerRotation(selectedSticker, currentRotation + 15);
    } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        setStickerRotation(selectedSticker, 0);
    } else if (e.key === 'Delete' || e.key === 'Del') {
        e.preventDefault();
        selectedSticker.remove();
        selectedSticker = null;
        hideStickerToolbars();
    }
});

// =====================================================================
// Paper & Frame Controls
// =====================================================================

document.querySelectorAll('[data-paper]').forEach(btn => {
    btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-paper');
        paper.className = 'paper ' + type;
        if (linesOn) paper.classList.add('lined');
        document.querySelectorAll('[data-paper]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const inkVal = inkSelect.value;
        if (type === 'dark') {
            letterBody.style.color = '#c9a9a6';
            letterDate.style.color = '#8B0000';
            letterGreeting.style.color = '#c9a9a6';
            signatureLabel.style.color = '#c9a9a6';
            signatureName.style.color = '#c9a9a6';
        } else {
            letterBody.style.color = inkVal;
            letterDate.style.color = '#5A0F2E';
            letterGreeting.style.color = '#2B0000';
            signatureLabel.style.color = '#5A0F2E';
            signatureName.style.color = '#8B0000';
        }
    });
});

linesBtn.addEventListener('click', () => {
    linesOn = !linesOn;
    paper.classList.toggle('lined', linesOn);
    linesBtn.textContent = linesOn ? 'On' : 'Off';
    linesBtn.classList.toggle('active', linesOn);
});

modeBtn.addEventListener('click', () => {
    letterMode = !letterMode;
    if (letterMode) {
        modeBtn.textContent = '✦ Letter';
        modeBtn.classList.add('active');
        header.classList.add('show');
        signature.classList.add('show');
    } else {
        modeBtn.textContent = '◌ Free';
        modeBtn.classList.remove('active');
        header.classList.remove('show');
        signature.classList.remove('show');
    }
});

document.querySelectorAll('[data-light]').forEach(btn => {
    btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-light');
        vignette.className = 'vignette ' + mode;
        document.querySelectorAll('[data-light]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

inkSelect.addEventListener('change', () => {
    if (!paper.classList.contains('dark')) {
        letterBody.style.color = inkSelect.value;
    }
});

document.getElementById('sizeMinus').addEventListener('click', () => {
    currentFontSize = Math.max(10, currentFontSize - 1);
    letterBody.style.fontSize = currentFontSize + 'px';
    sizeDisplay.textContent = currentFontSize + 'px';
});

document.getElementById('sizePlus').addEventListener('click', () => {
    currentFontSize = Math.min(28, currentFontSize + 1);
    letterBody.style.fontSize = currentFontSize + 'px';
    sizeDisplay.textContent = currentFontSize + 'px';
});

// Frames
const frames = {
    none: '',
    floral: `<svg class="frame-svg" viewBox="0 0 595 842" xmlns="http://www.w3.org/2000/svg"><g opacity="0.55" fill="none"><circle cx="30" cy="30" r="18" stroke="#8B0000" stroke-width="0.8"/><circle cx="565" cy="30" r="18" stroke="#8B0000" stroke-width="0.8"/><circle cx="30" cy="812" r="18" stroke="#8B0000" stroke-width="0.8"/><circle cx="565" cy="812" r="18" stroke="#8B0000" stroke-width="0.8"/><path d="M30 30 Q50 10 80 20 Q60 40 30 30Z" fill="#8B0000" opacity="0.6"/><path d="M565 30 Q545 10 515 20 Q535 40 565 30Z" fill="#8B0000" opacity="0.6"/><path d="M30 812 Q50 832 80 822 Q60 802 30 812Z" fill="#8B0000" opacity="0.6"/><path d="M565 812 Q545 832 515 822 Q535 802 565 812Z" fill="#8B0000" opacity="0.6"/><path d="M48 48 C 100 30, 200 50, 297 45 C 394 40, 494 30, 547 48" stroke="#8B0000" stroke-width="0.6" opacity="0.5"/><path d="M48 794 C 100 812, 200 792, 297 797 C 394 802, 494 812, 547 794" stroke="#8B0000" stroke-width="0.6" opacity="0.5"/><text x="297" y="26" text-anchor="middle" fill="#8B0000" font-size="10" opacity="0.5">✿</text><text x="297" y="826" text-anchor="middle" fill="#8B0000" font-size="10" opacity="0.5">✿</text></g></svg>`,
    baroque: `<svg class="frame-svg" viewBox="0 0 595 842" xmlns="http://www.w3.org/2000/svg"><g opacity="0.5"><rect x="18" y="18" width="559" height="806" fill="none" stroke="#2B0000" stroke-width="2"/><rect x="24" y="24" width="547" height="794" fill="none" stroke="#8B0000" stroke-width="0.5"/><path d="M18 18 L50 18 L50 22 L22 22 L22 50 L18 50 Z" fill="#2B0000"/><path d="M577 18 L545 18 L545 22 L573 22 L573 50 L577 50 Z" fill="#2B0000"/><path d="M18 824 L50 824 L50 820 L22 820 L22 792 L18 792 Z" fill="#2B0000"/><path d="M577 824 L545 824 L545 820 L573 820 L573 792 L577 792 Z" fill="#2B0000"/><text x="297" y="14" text-anchor="middle" fill="#8B0000" font-size="12">⚜ ✦ ⚜</text><text x="297" y="838" text-anchor="middle" fill="#8B0000" font-size="12">⚜ ✦ ⚜</text></g></svg>`,
    minimal: `<svg class="frame-svg" viewBox="0 0 595 842" xmlns="http://www.w3.org/2000/svg"><g opacity="0.4"><rect x="30" y="30" width="535" height="782" fill="none" stroke="#5A0F2E" stroke-width="0.8"/><line x1="30" y1="30" x2="60" y2="30" stroke="#8B0000" stroke-width="1.5"/><line x1="30" y1="30" x2="30" y2="60" stroke="#8B0000" stroke-width="1.5"/><line x1="565" y1="30" x2="535" y2="30" stroke="#8B0000" stroke-width="1.5"/><line x1="565" y1="30" x2="565" y2="60" stroke="#8B0000" stroke-width="1.5"/><line x1="30" y1="812" x2="60" y2="812" stroke="#8B0000" stroke-width="1.5"/><line x1="30" y1="812" x2="30" y2="782" stroke="#8B0000" stroke-width="1.5"/><line x1="565" y1="812" x2="535" y2="812" stroke="#8B0000" stroke-width="1.5"/><line x1="565" y1="812" x2="565" y2="782" stroke="#8B0000" stroke-width="1.5"/></g></svg>`,
    heart: `<svg class="frame-svg" viewBox="0 0 595 842" xmlns="http://www.w3.org/2000/svg"><g opacity="0.45"><path d="M297 60 C 297 40, 260 20, 240 40 C 220 60, 240 90, 297 110 C 354 90, 374 60, 354 40 C 334 20, 297 40, 297 60Z" fill="none" stroke="#8B0000" stroke-width="1"/><path d="M297 782 C 297 762, 260 742, 240 762 C 220 782, 240 812, 297 832 C 354 812, 374 782, 354 762 C 334 742, 297 762, 297 782Z" fill="none" stroke="#8B0000" stroke-width="1"/><path d="M50 421 C 30 421, 10 384, 30 364 C 50 344, 80 364, 70 421 C 80 478, 50 498, 30 478 C 10 458, 30 421, 50 421Z" fill="none" stroke="#8B0000" stroke-width="1"/><path d="M545 421 C 565 421, 585 384, 565 364 C 545 344, 515 364, 525 421 C 515 478, 545 498, 565 478 C 585 458, 565 421, 545 421Z" fill="none" stroke="#8B0000" stroke-width="1"/><rect x="20" y="20" width="555" height="802" fill="none" stroke="#5A0F2E" stroke-width="0.5" stroke-dasharray="4,6"/></g></svg>`,
    grunge: `<svg class="frame-svg" viewBox="0 0 595 842" xmlns="http://www.w3.org/2000/svg"><g opacity="0.35"><path d="M10 10 Q 40 8 80 12 Q 120 9 160 11 L 585 35 Q 588 100 585 200 L 585 807 Q 585 832 560 832 L 10 832 Q -15 832 10 807 Q 7 742 10 642 L 9 421 Q 12 300 9 200 Q 7 100 10 35 Z" fill="none" stroke="#2B0000" stroke-width="1.2"/><circle cx="80" cy="80" r="12" fill="rgba(139,0,0,0.3)"/><circle cx="515" cy="762" r="18" fill="rgba(90,15,46,0.25)"/></g></svg>`
};

document.querySelectorAll('[data-frame]').forEach(el => {
    el.addEventListener('click', () => {
        const frameType = el.getAttribute('data-frame');
        paperFrame.innerHTML = frames[frameType] || '';
        document.querySelectorAll('[data-frame]').forEach(f => f.classList.remove('active'));
        el.classList.add('active');
    });
});

document.querySelectorAll('[data-font]').forEach(el => {
    el.addEventListener('click', () => {
        const font = el.getAttribute('data-font');
        letterBody.style.fontFamily = `'${font}', serif`;
        document.querySelectorAll('[data-font]').forEach(f => f.classList.remove('active'));
        el.classList.add('active');
    });
});

document.querySelectorAll('[data-effect]').forEach(btn => {
    btn.addEventListener('click', () => {
        const effect = btn.getAttribute('data-effect');
        switch(effect) {
            case 'bleed':
                letterBody.style.textShadow = '1px 1px 3px rgba(139,0,0,0.4), -0.5px 0 2px rgba(43,0,0,0.3)';
                letterBody.style.opacity = '1';
                break;
            case 'glow':
                letterBody.style.textShadow = '0 0 8px rgba(139,0,0,0.5), 0 0 16px rgba(139,0,0,0.2)';
                letterBody.style.opacity = '1';
                break;
            case 'fade':
                letterBody.style.textShadow = 'none';
                letterBody.style.opacity = '0.65';
                break;
            case 'none':
                letterBody.style.textShadow = 'none';
                letterBody.style.opacity = '1';
                break;
        }
    });
});

// =====================================================================
// Sticker Buttons (Emoji, Pre-loaded, Upload)
// =====================================================================

document.querySelectorAll('[data-sticker]').forEach(btn => {
    btn.addEventListener('click', () => {
        addSticker(btn.getAttribute('data-sticker'));
    });
});

document.querySelectorAll('[data-image-sticker]').forEach(btn => {
    btn.addEventListener('click', () => {
        const imageKey = btn.getAttribute('data-image-sticker');
        addPreLoadedImageSticker(imageKey);
    });
});

const addImageBtn = document.querySelector('.add-image');
const imageInput = document.getElementById('imageInput');

if (addImageBtn && imageInput) {
    addImageBtn.addEventListener('click', () => {
        imageInput.click();
    });

    imageInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            addImageSticker(e.target.result);
        };
        reader.readAsDataURL(file);
        imageInput.value = '';
    });
}

// =====================================================================
// Side Panel Toggle
// =====================================================================

const sidePanel = document.getElementById('sidePanel');
const panelToggle = document.getElementById('panelToggle');
let panelOpen = false;

function updateSidePanelPosition() {
    const toolbar = document.querySelector('.toolbar');
    if (toolbar && sidePanel) {
        const toolbarRect = toolbar.getBoundingClientRect();
        const toolbarBottom = toolbarRect.bottom;
        sidePanel.style.top = toolbarBottom + 'px';
        sidePanel.style.height = `calc(100vh - ${toolbarBottom}px)`;
    }
}

function togglePanel() {
    panelOpen = !panelOpen;
    if (panelOpen) {
        sidePanel.classList.add('open');
        panelToggle.style.right = '200px';
        setTimeout(updateSidePanelPosition, 10);
    } else {
        sidePanel.classList.remove('open');
        panelToggle.style.right = '0';
    }
}

panelToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePanel();
});

updateSidePanelPosition();
window.addEventListener('resize', () => setTimeout(updateSidePanelPosition, 100));

const toolbarObs = document.querySelector('.toolbar');
if (toolbarObs) {
    const resizeObserver = new ResizeObserver(() => updateSidePanelPosition());
    resizeObserver.observe(toolbarObs);
}

// =====================================================================
// Export & Copy Functions
// =====================================================================

document.getElementById('exportPNGBtn').addEventListener('click', () => {
    html2canvas(paper, { scale: 2, backgroundColor: null, useCORS: true }).then(canvas => {
        const link = document.createElement('a');
        link.download = 'gothic-letter.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    }).catch(() => alert('Error exporting image.'));
});

document.getElementById('copyTextBtn').addEventListener('click', () => {
    const parts = [];
    if (letterMode) {
        parts.push(letterDate.textContent);
        parts.push('');
        parts.push(letterGreeting.textContent);
        parts.push('');
    }
    parts.push(letterBody.textContent);
    if (letterMode) {
        parts.push('');
        parts.push(signatureLabel.textContent);
        parts.push(signatureName.textContent);
    }
    navigator.clipboard.writeText(parts.join('\n')).then(() => {
        const btn = document.getElementById('copyTextBtn');
        const originalText = btn.textContent;
        btn.textContent = '✦ Copied!';
        setTimeout(() => btn.textContent = originalText, 1500);
    });
});

// =====================================================================
// Initialization & Paper Tilt Effect
// =====================================================================

document.querySelector('[data-paper="parchment"]').classList.add('active');
document.querySelector('[data-light="normal"]').classList.add('active');
modeBtn.classList.add('active');
updateLockButtonState();

paper.addEventListener('mousemove', (e) => {
    const rect = paper.getBoundingClientRect();
    const cx = rect.width / 2, cy = rect.height / 2;
    const dx = (e.clientX - rect.left - cx) / cx;
    const dy = (e.clientY - rect.top - cy) / cy;
    paper.style.transform = `perspective(1200px) rotateY(${dx * 1.5}deg) rotateX(${-dy * 1}deg)`;
});

paper.addEventListener('mouseleave', () => {
    paper.style.transform = 'perspective(1200px) rotateY(0deg) rotateX(0deg)';
});