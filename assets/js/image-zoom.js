/**
 * TYPO3 Documentation Image Zoom
 *
 * Provides multiple zoom modes for figures and images:
 * - lightbox: Click to open full-size in overlay (native dialog)
 * - gallery: Click to open with wheel zoom and gallery navigation
 * - inline: Wheel zoom directly on image
 * - lens: Magnifier lens follows cursor
 */
(function() {
    'use strict';

    // ==========================================================================
    // Configuration
    // ==========================================================================
    var CONFIG = {
        maxZoom: 4,
        minZoom: 1,
        zoomStep: 0.25,
        inlineMaxZoom: 3,
        lensZoomFactor: 2
    };

    // ==========================================================================
    // Helper: Create Element
    // ==========================================================================
    function createElement(tag, className, attrs) {
        var el = document.createElement(tag);
        if (className) el.className = className;
        if (attrs) {
            Object.keys(attrs).forEach(function(key) {
                if (key === 'text') {
                    el.textContent = attrs[key];
                } else {
                    el.setAttribute(key, attrs[key]);
                }
            });
        }
        return el;
    }

    // ==========================================================================
    // Native Dialog Lightbox
    // ==========================================================================
    function initDialogLightbox() {
        document.querySelectorAll('[data-zoom="lightbox"]').forEach(function(trigger) {
            var dialogId = trigger.getAttribute('data-zoom-dialog');
            var dialog = document.getElementById(dialogId);
            if (!dialog) return;

            trigger.addEventListener('dragstart', function(e) { e.preventDefault(); });

            trigger.addEventListener('click', function() {
                dialog.showModal();
            });

            trigger.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    dialog.showModal();
                }
            });

            // Close on any click (image or backdrop) - toggle behavior
            dialog.addEventListener('click', function(e) {
                // Don't close if clicking the close button (it handles itself)
                if (e.target.classList.contains('lightbox-close')) return;
                dialog.close();
            });

            var closeBtn = dialog.querySelector('.lightbox-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', function() {
                    dialog.close();
                });
            }
        });
    }

    // ==========================================================================
    // Gallery with Wheel Zoom
    // ==========================================================================
    function initGallery() {
        var galleries = {};

        document.querySelectorAll('[data-zoom="gallery"]').forEach(function(trigger) {
            var galleryId = trigger.getAttribute('data-gallery') || 'default';
            if (!galleries[galleryId]) {
                galleries[galleryId] = {
                    images: [],
                    currentIndex: 0,
                    zoom: 1,
                    panX: 0,
                    panY: 0,
                    dragging: false
                };
            }

            var imgSrc = trigger.getAttribute('data-zoom-src') || trigger.src;
            var caption = trigger.getAttribute('data-zoom-caption') || trigger.alt || '';

            galleries[galleryId].images.push({
                src: imgSrc,
                caption: caption,
                trigger: trigger
            });

            var index = galleries[galleryId].images.length - 1;
            trigger.setAttribute('data-gallery-index', index);

            trigger.addEventListener('dragstart', function(e) { e.preventDefault(); });

            trigger.addEventListener('click', function(e) {
                e.preventDefault();
                openGallery(galleryId, index);
            });
        });

        if (Object.keys(galleries).length === 0) return;

        var overlay = createGalleryOverlay();
        document.body.appendChild(overlay);

        var img = overlay.querySelector('.gallery-img');
        var caption = overlay.querySelector('.gallery-caption');
        var counterCurrent = overlay.querySelector('.gallery-counter-current');
        var counterTotal = overlay.querySelector('.gallery-counter-total');
        var zoomLevel = overlay.querySelector('.gallery-zoom-level');
        var content = overlay.querySelector('.gallery-content');

        var currentGallery = null;
        var startX, startY;

        function openGallery(galleryId, index) {
            currentGallery = galleries[galleryId];
            currentGallery.currentIndex = index;
            currentGallery.zoom = 1;
            currentGallery.panX = 0;
            currentGallery.panY = 0;
            showCurrentImage();
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
            counterTotal.textContent = currentGallery.images.length;
        }

        function closeGallery() {
            overlay.classList.remove('active');
            document.body.style.overflow = '';
            currentGallery = null;
        }

        function showCurrentImage() {
            if (!currentGallery) return;
            var current = currentGallery.images[currentGallery.currentIndex];
            img.src = current.src;
            img.alt = current.caption;
            caption.textContent = current.caption;
            counterCurrent.textContent = currentGallery.currentIndex + 1;
            resetZoom();
        }

        function navigate(delta) {
            if (!currentGallery) return;
            var len = currentGallery.images.length;
            currentGallery.currentIndex = (currentGallery.currentIndex + delta + len) % len;
            showCurrentImage();
        }

        function setZoom(newZoom) {
            if (!currentGallery) return;
            currentGallery.zoom = Math.max(CONFIG.minZoom, Math.min(CONFIG.maxZoom, newZoom));
            if (currentGallery.zoom === 1) {
                currentGallery.panX = 0;
                currentGallery.panY = 0;
            }
            updateTransform();
        }

        function resetZoom() {
            if (!currentGallery) return;
            currentGallery.zoom = 1;
            currentGallery.panX = 0;
            currentGallery.panY = 0;
            updateTransform();
        }

        function updateTransform() {
            if (!currentGallery) return;
            img.style.transform = 'scale(' + currentGallery.zoom + ') translate(' + currentGallery.panX + 'px, ' + currentGallery.panY + 'px)';
            zoomLevel.textContent = Math.round(currentGallery.zoom * 100) + '%';
            img.style.cursor = currentGallery.zoom > 1 ? 'grab' : 'zoom-in';
        }

        overlay.querySelector('.gallery-close').addEventListener('click', closeGallery);
        overlay.querySelector('.gallery-prev').addEventListener('click', function() { navigate(-1); });
        overlay.querySelector('.gallery-next').addEventListener('click', function() { navigate(1); });
        overlay.querySelector('.gallery-zoom-in').addEventListener('click', function() { setZoom(currentGallery.zoom + 0.5); });
        overlay.querySelector('.gallery-zoom-out').addEventListener('click', function() { setZoom(currentGallery.zoom - 0.5); });
        overlay.querySelector('.gallery-zoom-reset').addEventListener('click', resetZoom);

        content.addEventListener('wheel', function(e) {
            if (!currentGallery) return;
            e.preventDefault();
            var delta = e.deltaY > 0 ? -CONFIG.zoomStep : CONFIG.zoomStep;
            setZoom(currentGallery.zoom + delta);
        }, { passive: false });

        img.addEventListener('dragstart', function(e) { e.preventDefault(); });

        img.addEventListener('mousedown', function(e) {
            if (!currentGallery || currentGallery.zoom <= 1) return;
            e.preventDefault();
            currentGallery.dragging = true;
            startX = e.clientX - currentGallery.panX;
            startY = e.clientY - currentGallery.panY;
            img.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', function(e) {
            if (!currentGallery || !currentGallery.dragging) return;
            e.preventDefault();
            currentGallery.panX = e.clientX - startX;
            currentGallery.panY = e.clientY - startY;
            updateTransform();
        });

        document.addEventListener('mouseup', function() {
            if (!currentGallery) return;
            currentGallery.dragging = false;
            if (currentGallery.zoom > 1) {
                img.style.cursor = 'grab';
            }
        });

        document.addEventListener('keydown', function(e) {
            if (!overlay.classList.contains('active')) return;
            switch(e.key) {
                case 'Escape': closeGallery(); break;
                case 'ArrowLeft': navigate(-1); break;
                case 'ArrowRight': navigate(1); break;
                case '+': case '=': setZoom(currentGallery.zoom + 0.5); break;
                case '-': setZoom(currentGallery.zoom - 0.5); break;
                case '0': resetZoom(); break;
            }
        });

        // Close on click - toggle behavior (but not when zoomed/panning)
        overlay.addEventListener('click', function(e) {
            // Don't close if clicking toolbar buttons or nav
            if (e.target.closest('.gallery-toolbar') || e.target.closest('.gallery-nav')) return;
            // Close if not zoomed, or if clicking backdrop/content area
            if (!currentGallery || currentGallery.zoom <= 1) {
                closeGallery();
            }
        });
    }

    function createGalleryOverlay() {
        var overlay = createElement('div', 'image-gallery-overlay');

        // Counter
        var counter = createElement('span', 'gallery-counter');
        var counterCurrent = createElement('span', 'gallery-counter-current');
        counterCurrent.textContent = '1';
        var counterTotal = createElement('span', 'gallery-counter-total');
        counterTotal.textContent = '1';
        counter.appendChild(counterCurrent);
        counter.appendChild(document.createTextNode(' / '));
        counter.appendChild(counterTotal);
        overlay.appendChild(counter);

        // Zoom level
        var zoomLevel = createElement('div', 'gallery-zoom-level');
        zoomLevel.textContent = '100%';
        overlay.appendChild(zoomLevel);

        // Toolbar
        var toolbar = createElement('div', 'gallery-toolbar');
        var btnZoomOut = createElement('button', 'gallery-zoom-out', { title: 'Zoom Out (scroll down)', text: '−' });
        var btnZoomIn = createElement('button', 'gallery-zoom-in', { title: 'Zoom In (scroll up)', text: '+' });
        var btnZoomReset = createElement('button', 'gallery-zoom-reset', { title: 'Reset Zoom', text: '1:1' });
        var btnClose = createElement('button', 'gallery-close', { title: 'Close (ESC)', text: '×' });
        toolbar.appendChild(btnZoomOut);
        toolbar.appendChild(btnZoomIn);
        toolbar.appendChild(btnZoomReset);
        toolbar.appendChild(btnClose);
        overlay.appendChild(toolbar);

        // Content
        var content = createElement('div', 'gallery-content');
        var img = createElement('img', 'gallery-img', { src: '', alt: '' });
        content.appendChild(img);
        overlay.appendChild(content);

        // Caption
        var caption = createElement('p', 'gallery-caption');
        overlay.appendChild(caption);

        // Navigation
        var prevBtn = createElement('button', 'gallery-nav prev gallery-prev', { title: 'Previous (←)', text: '❮' });
        var nextBtn = createElement('button', 'gallery-nav next gallery-next', { title: 'Next (→)', text: '❯' });
        overlay.appendChild(prevBtn);
        overlay.appendChild(nextBtn);

        return overlay;
    }

    // ==========================================================================
    // Inline Zoom (Product-Style)
    // ==========================================================================
    function initInlineZoom() {
        document.querySelectorAll('[data-zoom="inline"]').forEach(function(container) {
            var img = container.querySelector('img') || container;
            var zoom = 1;
            var panX = 0, panY = 0;
            var dragging = false;
            var startX, startY;

            img.addEventListener('dragstart', function(e) { e.preventDefault(); });
            img.style.userSelect = 'none';

            function updateTransform() {
                img.style.transform = 'scale(' + zoom + ') translate(' + panX + 'px, ' + panY + 'px)';
                container.classList.toggle('zoomed', zoom > 1);
            }

            container.addEventListener('wheel', function(e) {
                e.preventDefault();

                // Get mouse position relative to image center
                var rect = img.getBoundingClientRect();
                var mouseX = e.clientX - (rect.left + rect.width / 2);
                var mouseY = e.clientY - (rect.top + rect.height / 2);

                var oldZoom = zoom;
                var delta = e.deltaY > 0 ? -0.2 : 0.2;
                var newZoom = Math.max(CONFIG.minZoom, Math.min(CONFIG.inlineMaxZoom, zoom + delta));

                if (newZoom === 1) {
                    panX = 0;
                    panY = 0;
                } else if (oldZoom !== newZoom) {
                    // Adjust pan to zoom toward cursor position
                    // Keep the point under cursor stationary during zoom
                    panX = panX + mouseX * (1/oldZoom - 1/newZoom);
                    panY = panY + mouseY * (1/oldZoom - 1/newZoom);
                }

                zoom = newZoom;
                updateTransform();
            }, { passive: false });

            img.addEventListener('mousedown', function(e) {
                if (zoom <= 1) return;
                e.preventDefault();
                dragging = true;
                startX = e.clientX - panX;
                startY = e.clientY - panY;
                container.classList.add('dragging');
            });

            document.addEventListener('mousemove', function(e) {
                if (!dragging) return;
                e.preventDefault();
                panX = e.clientX - startX;
                panY = e.clientY - startY;
                updateTransform();
            });

            document.addEventListener('mouseup', function() {
                dragging = false;
                container.classList.remove('dragging');
            });

            img.addEventListener('dblclick', function() {
                zoom = 1;
                panX = 0;
                panY = 0;
                updateTransform();
            });
        });
    }

    // ==========================================================================
    // Magnifier Lens
    // ==========================================================================
    function initLensZoom() {
        document.querySelectorAll('[data-zoom="lens"]').forEach(function(container) {
            var img = container.querySelector('img');
            if (!img) return;

            var lens = createElement('div', 'zoom-lens');
            container.appendChild(lens);

            var result = createElement('div', 'zoom-result-panel');
            container.appendChild(result);

            var zoomFactor = parseFloat(container.getAttribute('data-zoom-factor')) || CONFIG.lensZoomFactor;

            container.addEventListener('mousemove', function(e) {
                var rect = img.getBoundingClientRect();
                var x = e.clientX - rect.left;
                var y = e.clientY - rect.top;

                var lensX = x - lens.offsetWidth / 2;
                var lensY = y - lens.offsetHeight / 2;

                lensX = Math.max(0, Math.min(rect.width - lens.offsetWidth, lensX));
                lensY = Math.max(0, Math.min(rect.height - lens.offsetHeight, lensY));

                lens.style.left = lensX + 'px';
                lens.style.top = lensY + 'px';

                var bgX = -lensX * zoomFactor;
                var bgY = -lensY * zoomFactor;
                lens.style.backgroundImage = 'url(' + img.src + ')';
                lens.style.backgroundSize = (rect.width * zoomFactor) + 'px ' + (rect.height * zoomFactor) + 'px';
                lens.style.backgroundPosition = bgX + 'px ' + bgY + 'px';

                var resultBgX = -x * zoomFactor + result.offsetWidth / 2;
                var resultBgY = -y * zoomFactor + result.offsetHeight / 2;
                result.style.backgroundImage = 'url(' + img.src + ')';
                result.style.backgroundSize = (rect.width * zoomFactor) + 'px ' + (rect.height * zoomFactor) + 'px';
                result.style.backgroundPosition = resultBgX + 'px ' + resultBgY + 'px';
            });

            container.addEventListener('mouseleave', function() {
                lens.style.display = 'none';
                result.style.display = 'none';
            });

            container.addEventListener('mouseenter', function() {
                lens.style.display = 'block';
                result.style.display = 'block';
            });
        });
    }

    // ==========================================================================
    // Initialize
    // ==========================================================================
    function init() {
        initDialogLightbox();
        initGallery();
        initInlineZoom();
        initLensZoom();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.TYPO3DocsImageZoom = {
        init: init,
        initDialogLightbox: initDialogLightbox,
        initGallery: initGallery,
        initInlineZoom: initInlineZoom,
        initLensZoom: initLensZoom
    };
})();
