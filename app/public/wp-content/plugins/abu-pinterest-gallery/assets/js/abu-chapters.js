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
		
		// Create a map of section IDs to nav links
		const linkMap = {};
		links.forEach(link => {
			const chapterId = link.getAttribute('data-chapter-id');
			if (chapterId) {
				linkMap[chapterId] = link;
			}
		});
		
		// IntersectionObserver to track which chapter is in view
		const observerOptions = {
			root: null,
			rootMargin: `-${navHeight}px 0px -50% 0px`, // Trigger when top of section hits below nav
			threshold: 0
		};
		
		let currentActiveId = null;
		
		const observer = new IntersectionObserver((entries) => {
			// Find the first intersecting section (topmost visible section)
			let newActiveId = null;
			
			entries.forEach(entry => {
				if (entry.isIntersecting) {
					const sectionId = entry.target.getAttribute('data-chapter-id');
					if (!newActiveId || entry.target.getBoundingClientRect().top < 
					    document.querySelector(`[data-chapter-id="${newActiveId}"]`).getBoundingClientRect().top) {
						newActiveId = sectionId;
					}
				}
			});
			
			// Update active state if changed
			if (newActiveId && newActiveId !== currentActiveId) {
				currentActiveId = newActiveId;
				
				// Remove active class from all links
				links.forEach(link => link.classList.remove('is-active'));
				
				// Add active class to current link
				if (linkMap[newActiveId]) {
					linkMap[newActiveId].classList.add('is-active');
				}
			}
		}, observerOptions);
		
		// Observe all chapter sections
		sections.forEach(section => observer.observe(section));
		
		// Set initial active state
		if (sections.length > 0) {
			const firstChapterId = sections[0].getAttribute('data-chapter-id');
			if (linkMap[firstChapterId]) {
				linkMap[firstChapterId].classList.add('is-active');
				currentActiveId = firstChapterId;
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
