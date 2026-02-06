/**
 * ABU Gallery Chapters - Navigation & Multi-Grid Masonry
 * 
 * Phase 2: Smooth scroll, active chapter highlighting, and masonry initialization
 */

(function() {
	'use strict';
	
	// Wait for DOM to be ready
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
	
	function init() {
		// Skip initialization if we're in direct mode (spotlight-first rendering)
		// The background gallery will be initialized separately by gallery.js
		const directMode = document.querySelector('.abu-pg-direct-mode');
		if (directMode) {
			console.log('[Chapters] Skipping init - direct mode detected');
			return;
		}
		
		const wrapper = document.querySelector('.abu-pg-chapters-wrapper');
		if (!wrapper) return;
		
		initSmoothScroll();
		initActiveChapterHighlighting();
		initMultiGridMasonry();
	}
	
	/**
	 * Initialize smooth scroll with nav offset for chapter links
	 */
	function initSmoothScroll() {
		const nav = document.querySelector('.abu-pg-chapters-nav');
		if (!nav) return;
		
		const navHeight = nav.offsetHeight;
		const links = nav.querySelectorAll('.abu-pg-chapter-link');
		const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		
		links.forEach(link => {
			link.addEventListener('click', (e) => {
				e.preventDefault();
				
				const targetId = link.getAttribute('href');
				const targetSection = document.querySelector(targetId);
				
				if (!targetSection) return;
				
				// Calculate position with nav offset
				const targetPosition = targetSection.getBoundingClientRect().top + window.pageYOffset - navHeight;
				
				// Smooth scroll (respect reduced motion preference)
				window.scrollTo({
					top: targetPosition,
					behavior: prefersReducedMotion ? 'auto' : 'smooth'
				});
			});
		});
	}
	
	/**
	 * Highlight active chapter in nav based on scroll position using IntersectionObserver
	 */
	function initActiveChapterHighlighting() {
		const nav = document.querySelector('.abu-pg-chapters-nav');
		const sections = document.querySelectorAll('.abu-pg-chapter-section');
		const links = document.querySelectorAll('.abu-pg-chapter-link');
		
		if (!nav || sections.length === 0 || links.length === 0) return;
		
		const navHeight = nav.offsetHeight;
		
		// Create a map of section slugs to nav links
		const linkMap = {};
		links.forEach(link => {
			const chapterSlug = link.getAttribute('data-chapter-slug');
			if (chapterSlug) {
				linkMap[chapterSlug] = link;
			}
		});
		
		// IntersectionObserver to track which chapter is in view
		const observerOptions = {
			root: null,
			rootMargin: `-${navHeight}px 0px -50% 0px`, // Trigger when top of section hits below nav
			threshold: 0
		};
		
		let currentActiveSlug = null;
		
		const observer = new IntersectionObserver((entries) => {
			// Find the first intersecting section (topmost visible section)
			let newActiveSlug = null;
			
			entries.forEach(entry => {
				if (entry.isIntersecting) {
					const sectionSlug = entry.target.getAttribute('data-chapter-slug');
					if (!newActiveSlug || entry.target.getBoundingClientRect().top < 
					    document.querySelector(`[data-chapter-slug="${newActiveSlug}"]`).getBoundingClientRect().top) {
						newActiveSlug = sectionSlug;
					}
				}
			});
			
		// Update active state if changed
		if (newActiveSlug && newActiveSlug !== currentActiveSlug) {
			currentActiveSlug = newActiveSlug;
			
			// Remove active class from all links
			links.forEach(link => link.classList.remove('is-active'));
			
			// Add active class to current link
			if (linkMap[newActiveSlug]) {
				linkMap[newActiveSlug].classList.add('is-active');
			}
			
			// Update URL with chapter parameter (but not during initial load to prevent interference with deep-linking)
			if (typeof window.URLStateManager !== 'undefined' && 
			    !window.URLStateManager.isInitialLoad()) {
				window.URLStateManager.setChapter(newActiveSlug);
			}
		}
		}, observerOptions);
		
		// Observe all chapter sections
		sections.forEach(section => observer.observe(section));
		
		// Set initial active state
		if (sections.length > 0) {
			const firstChapterSlug = sections[0].getAttribute('data-chapter-slug');
			if (linkMap[firstChapterSlug]) {
				linkMap[firstChapterSlug].classList.add('is-active');
				currentActiveSlug = firstChapterSlug;
			}
		}
	}
	
	/**
	 * Initialize masonry layout for each chapter grid
	 * 
	 * This adapts the existing single-grid masonry to handle multiple grids
	 */
	function initMultiGridMasonry() {
		// Check if the global masonry initialization exists
		if (typeof window.abuPgGalleryInit !== 'function') {
			console.warn('ABU Gallery: Masonry initialization function not found. Masonry may not work correctly.');
			return;
		}
		
		// Find all gallery containers (one per chapter)
		const galleries = document.querySelectorAll('.abu-pg-chapter-section .abu-pg-gallery');
		
		if (galleries.length === 0) return;
		
		// Initialize masonry for each gallery
		galleries.forEach((gallery, index) => {
			// The existing gallery.js should handle initialization via data attributes
			// We just need to ensure each gallery is processed
			// Check if gallery has the required data attributes
			if (!gallery.hasAttribute('data-column-width') || !gallery.hasAttribute('data-gutter')) {
				console.warn(`ABU Gallery: Chapter grid ${index + 1} missing required data attributes`);
			}
		});
		
		// Trigger the existing masonry initialization
		// The existing gallery.js script should pick up all .abu-pg-gallery elements
		// and initialize them individually
		
		// If the original script uses a single selector, we may need to wait for it to load
		// and then manually trigger initialization for each grid
		setTimeout(() => {
			if (typeof window.abuPgGalleryInit === 'function') {
				galleries.forEach(gallery => {
					try {
						window.abuPgGalleryInit(gallery);
					} catch (e) {
						console.warn('ABU Gallery: Error initializing masonry for chapter grid:', e);
					}
				});
			}
		}, 100);
	}
	
})();
