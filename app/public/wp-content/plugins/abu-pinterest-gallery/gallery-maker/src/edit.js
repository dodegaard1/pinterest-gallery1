/**
 * WordPress dependencies
 */
import { useState, useEffect } from '@wordpress/element';
import { useEntityProp } from '@wordpress/core-data';
import { useSelect } from '@wordpress/data';
import { Button, TextControl, Placeholder, Spinner } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { store as editorStore } from '@wordpress/editor';
import { store as blockEditorStore } from '@wordpress/block-editor';

/**
 * Edit component for ABU Gallery Maker block.
 * 
 * Provides a two-column UI:
 * - Left sidebar: Chapter list with add/select/rename
 * - Right pane: Media grid with add/reorder capabilities
 * 
 * @param {Object} props Block props
 * @return {JSX.Element} Edit component
 */
export default function Edit( { clientId } ) {
	// Get post type and post ID
	const postType = useSelect( ( select ) => 
		select( editorStore ).getCurrentPostType(),
		[]
	);
	
	const postId = useSelect( ( select ) =>
		select( editorStore ).getCurrentPostId(),
		[]
	);
	
	// Get and set post meta
	const [ meta, setMeta ] = useEntityProp( 'postType', postType, 'meta' );
	
	// Parse chapters from meta
	const chaptersJson = meta?.abu_pg_chapters_json || '[]';
	let chapters = [];
	try {
		chapters = JSON.parse( chaptersJson );
	} catch ( e ) {
		chapters = [];
	}
	
	// Local state
	const [ selectedChapterId, setSelectedChapterId ] = useState( 
		chapters.length > 0 ? chapters[0].id : null 
	);
	const [ draggedMediaIndex, setDraggedMediaIndex ] = useState( null );
	const [ mediaData, setMediaData ] = useState( {} ); // Cache for attachment data
	
	// Initialize with one chapter if empty
	useEffect( () => {
		if ( chapters.length === 0 ) {
			const defaultChapter = {
				id: 'ch1',
				name: 'Chapter 1',
				order: 1,
				mediaIds: []
			};
			updateChapters( [ defaultChapter ] );
			setSelectedChapterId( 'ch1' );
		}
	}, [] );
	
	// Helper to update chapters in meta
	const updateChapters = ( newChapters ) => {
		setMeta( {
			...meta,
			abu_pg_chapters_json: JSON.stringify( newChapters )
		} );
	};
	
	// Get current selected chapter
	const currentChapter = chapters.find( ch => ch.id === selectedChapterId );
	
	// Add new chapter
	const addChapter = () => {
		const newId = `ch${ Date.now() }`;
		const newOrder = chapters.length + 1;
		const newChapter = {
			id: newId,
			name: `Chapter ${ newOrder }`,
			order: newOrder,
			mediaIds: []
		};
		updateChapters( [ ...chapters, newChapter ] );
		setSelectedChapterId( newId );
	};
	
	// Update chapter name
	const updateChapterName = ( chapterId, newName ) => {
		const updated = chapters.map( ch => 
			ch.id === chapterId ? { ...ch, name: newName } : ch
		);
		updateChapters( updated );
	};
	
	// Add media to current chapter
	const addMedia = () => {
		if ( ! currentChapter ) return;
		
		// Open WordPress Media Library
		const mediaFrame = wp.media( {
			title: __( 'Select Media for Chapter', 'abu-pinterest-gallery' ),
			button: {
				text: __( 'Add to Chapter', 'abu-pinterest-gallery' )
			},
			multiple: true,
			library: {
				type: [ 'image', 'video' ]
			}
		} );
		
		mediaFrame.on( 'select', () => {
			const selection = mediaFrame.state().get( 'selection' );
			const attachments = selection.toJSON();
			const newIds = attachments.map( att => att.id );
			
			// Cache attachment data
			const newMediaData = { ...mediaData };
			attachments.forEach( att => {
				newMediaData[ att.id ] = {
					id: att.id,
					url: att.url,
					title: att.title,
					filename: att.filename,
					mime: att.mime,
					sizes: att.sizes
				};
			} );
			setMediaData( newMediaData );
			
			// Add to current chapter
			const updated = chapters.map( ch => 
				ch.id === currentChapter.id 
					? { ...ch, mediaIds: [ ...ch.mediaIds, ...newIds ] }
					: ch
			);
			updateChapters( updated );
		} );
		
		mediaFrame.open();
	};
	
	// Remove media from current chapter
	const removeMedia = ( mediaId ) => {
		if ( ! currentChapter ) return;
		
		const updated = chapters.map( ch => 
			ch.id === currentChapter.id 
				? { ...ch, mediaIds: ch.mediaIds.filter( id => id !== mediaId ) }
				: ch
		);
		updateChapters( updated );
	};
	
	// Drag and drop handlers
	const handleDragStart = ( index ) => {
		setDraggedMediaIndex( index );
	};
	
	const handleDragOver = ( e ) => {
		e.preventDefault();
	};
	
	const handleDrop = ( dropIndex ) => {
		if ( draggedMediaIndex === null || ! currentChapter ) return;
		
		const mediaIds = [ ...currentChapter.mediaIds ];
		const draggedId = mediaIds[ draggedMediaIndex ];
		
		// Remove from old position
		mediaIds.splice( draggedMediaIndex, 1 );
		
		// Insert at new position
		mediaIds.splice( dropIndex, 0, draggedId );
		
		// Update chapter
		const updated = chapters.map( ch => 
			ch.id === currentChapter.id 
				? { ...ch, mediaIds }
				: ch
		);
		updateChapters( updated );
		
		setDraggedMediaIndex( null );
	};
	
	// Fetch attachment data for media IDs that aren't cached
	useEffect( () => {
		if ( ! currentChapter ) return;
		
		const uncachedIds = currentChapter.mediaIds.filter( 
			id => ! mediaData[ id ] 
		);
		
		if ( uncachedIds.length === 0 ) return;
		
		// Fetch attachment data via REST API
		uncachedIds.forEach( id => {
			wp.apiFetch( {
				path: `/wp/v2/media/${ id }`
			} ).then( attachment => {
				setMediaData( prev => ( {
					...prev,
					[ id ]: {
						id: attachment.id,
						url: attachment.source_url,
						title: attachment.title.rendered,
						filename: attachment.slug,
						mime: attachment.mime_type,
						sizes: attachment.media_details?.sizes || {}
					}
				} ) );
			} ).catch( () => {
				// If fetch fails, mark as invalid
				setMediaData( prev => ( {
					...prev,
					[ id ]: null
				} ) );
			} );
		} );
	}, [ currentChapter?.id, currentChapter?.mediaIds ] );
	
	// Render
	return (
		<div className="abu-gallery-maker">
			<div className="abu-gallery-maker__sidebar">
				<h3 className="abu-gallery-maker__sidebar-title">
					{ __( 'Chapters', 'abu-pinterest-gallery' ) }
				</h3>
				<div className="abu-gallery-maker__chapters">
					{ chapters.map( ( chapter ) => {
						const isActive = chapter.id === selectedChapterId;
						const isEmpty = chapter.mediaIds.length === 0;
						
						return (
							<div
								key={ chapter.id }
								className={ `abu-gallery-maker__chapter ${ isActive ? 'is-active' : '' }` }
								onClick={ () => setSelectedChapterId( chapter.id ) }
							>
								<TextControl
									value={ chapter.name }
									onChange={ ( value ) => updateChapterName( chapter.id, value ) }
									onClick={ ( e ) => e.stopPropagation() }
									className="abu-gallery-maker__chapter-name"
								/>
								{ isEmpty && (
									<div className="abu-gallery-maker__chapter-warning">
										⚠️ { __( 'Add media to this chapter', 'abu-pinterest-gallery' ) }
									</div>
								) }
							</div>
						);
					} ) }
				</div>
				<Button
					variant="secondary"
					onClick={ addChapter }
					className="abu-gallery-maker__add-chapter"
				>
					{ __( '+ Add Chapter', 'abu-pinterest-gallery' ) }
				</Button>
			</div>
			
			<div className="abu-gallery-maker__main">
				{ currentChapter ? (
					<>
						<div className="abu-gallery-maker__header">
							<h2>{ currentChapter.name }</h2>
							<Button
								variant="primary"
								onClick={ addMedia }
							>
								{ __( 'Add Media', 'abu-pinterest-gallery' ) }
							</Button>
						</div>
						
						{ currentChapter.mediaIds.length === 0 ? (
							<Placeholder
								icon="images-alt2"
								label={ __( 'No media in this chapter', 'abu-pinterest-gallery' ) }
								instructions={ __( 'Click "Add Media" to select images or videos for this chapter.', 'abu-pinterest-gallery' ) }
							/>
						) : (
							<div className="abu-gallery-maker__media-grid">
								{ currentChapter.mediaIds.map( ( mediaId, index ) => {
									const media = mediaData[ mediaId ];
									
									if ( ! media ) {
										return (
											<div key={ mediaId } className="abu-gallery-maker__media-item">
												<Spinner />
											</div>
										);
									}
									
									if ( media === null ) {
										return (
											<div key={ mediaId } className="abu-gallery-maker__media-item abu-gallery-maker__media-item--invalid">
												<div className="abu-gallery-maker__media-placeholder">
													{ __( 'Invalid media', 'abu-pinterest-gallery' ) }
												</div>
												<Button
													isDestructive
													isSmall
													onClick={ () => removeMedia( mediaId ) }
													className="abu-gallery-maker__remove"
												>
													×
												</Button>
											</div>
										);
									}
									
									const thumbnailUrl = media.sizes?.thumbnail?.source_url || media.url;
									const isVideo = media.mime?.startsWith( 'video/' );
									
									return (
										<div
											key={ mediaId }
											className="abu-gallery-maker__media-item"
											draggable
											onDragStart={ () => handleDragStart( index ) }
											onDragOver={ handleDragOver }
											onDrop={ () => handleDrop( index ) }
										>
											<div className="abu-gallery-maker__media-preview">
												{ isVideo ? (
													<div className="abu-gallery-maker__media-video">
														<video src={ media.url } />
														<span className="abu-gallery-maker__media-video-icon">▶</span>
													</div>
												) : (
													<img src={ thumbnailUrl } alt={ media.title } />
												) }
											</div>
											<div className="abu-gallery-maker__media-title">
												{ media.title || media.filename }
											</div>
											<Button
												isDestructive
												isSmall
												onClick={ () => removeMedia( mediaId ) }
												className="abu-gallery-maker__remove"
											>
												×
											</Button>
										</div>
									);
								} ) }
							</div>
						) }
					</>
				) : (
					<Placeholder
						icon="images-alt2"
						label={ __( 'No chapter selected', 'abu-pinterest-gallery' ) }
					/>
				) }
			</div>
		</div>
	);
}
