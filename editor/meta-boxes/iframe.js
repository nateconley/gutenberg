/**
 * External dependencies
 */
import { isEqual } from 'lodash';
import classnames from 'classnames';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { addQueryArgs } from '@wordpress/url';
import { Component } from '@wordpress/element';
import { Panel } from '@wordpress/components';

/**
 * Internal dependencies.
 */
import MetaBoxPanel from './panel.js';

// @TODO add error handling.
class MetaBoxIframe extends Component {
	constructor() {
		super( ...arguments );

		this.state = {
			width: 0,
			height: 0,
			isOpen: false,
		};

		this.originalFormData = [];
		this.hasLoaded = false;
		this.formData = [];
		this.form = null;

		this.checkMessageForResize = this.checkMessageForResize.bind( this );
		this.handleDoubleBuffering = this.handleDoubleBuffering.bind( this );
		this.handleMetaBoxReload = this.handleMetaBoxReload.bind( this );
		this.checkMetaBoxState = this.checkMetaBoxState.bind( this );
		this.observeChanges = this.observeChanges.bind( this );
		this.bindNode = this.bindNode.bind( this );
		this.isSaving = this.isSaving.bind( this );
		this.toggle = this.toggle.bind( this );
	}

	toggle() {
		this.setState( {
			isOpen: ! this.state.isOpen,
		} );
	}

	bindNode( node ) {
		this.node = node;
	}

	componentDidMount() {
		/**
		 * Sets up an event listener for resizing. The resizing occurs inside
		 * the iframe, see gutenberg/assets/js/meta-box-resize.js
		 */
		window.addEventListener( 'message', this.checkMessageForResize, false );

		// Initially set node to not display anything so that when it loads, we can see it.
		this.node.style.display = 'none';

		this.node.addEventListener( 'load', this.observeChanges );
	}

	componentWillReceiveProps( nextProps ) {
		// MetaBox updating.
		if ( nextProps.isUpdating === true ) {
			const iframe = this.node;

			this.clonedNode = iframe.cloneNode( true );
			this.clonedNode.classList.add( 'is-updating' );
			this.hideNode( this.clonedNode );
			const parent = iframe.parentNode;

			parent.appendChild( this.clonedNode );

			/**
			 * When the dom content has loaded for the cloned iframe handle the
			 * double buffering.
			 */
			this.clonedNode.addEventListener( 'load', this.handleDoubleBuffering );
		}
	}

	handleDoubleBuffering() {
		const { node, clonedNode, form } = this;

		form.submit();

		const cloneForm = clonedNode.contentWindow.document.getElementById( 'post' );

		// Make the cloned state match the current state visually.
		cloneForm.parentNode.replaceChild( form, cloneForm );

		this.showNode( clonedNode );
		this.hideNode( node );

		node.addEventListener( 'load', this.handleMetaBoxReload );
	}

	hideNode( node ) {
		node.classList.add( 'is-hidden' );
	}

	showNode( node ) {
		node.classList.remove( 'is-hidden' );
	}

	componentWillUnmount() {
		const iframe = this.node;
		iframe.removeEventListener( 'message', this.checkMessageForResize );

		if ( this.dirtyObserver ) {
			this.dirtyObserver.disconnect();
		}

		if ( this.form !== null ) {
			this.form.removeEventListener( 'input', this.checkMetaBoxState );
			this.form.removeEventListener( 'change', this.checkMetaBoxState );
		}

		this.node.removeEventListener( 'load', this.observeChanges );
	}

	observeChanges() {
		const node = this.node;

		// The standard post.php form ID post should probably be mimicked.
		this.form = this.node.contentWindow.document.getElementById( 'post' );

		// If the iframe has not already loaded before.
		if ( this.hasLoaded === false ) {
			node.style.display = 'block';
			this.originalFormData = this.getFormData();
			this.hasLoaded = true;
		}

		// Add event listeners to handle dirty checking.
		this.dirtyObserver = new window.MutationObserver( this.checkMetaBoxState );
		this.dirtyObserver.observe( this.form, {
			attributes: true,
			attributeOldValue: true,
			characterData: true,
			characterDataOldValue: true,
			childList: true,
			subtree: true,
		} );
		this.form.addEventListener( 'change', this.checkMetaBoxState );
		this.form.addEventListener( 'input', this.checkMetaBoxState );
	}

	getFormData() {
		const form = this.form;

		const data = new window.FormData( form );
		const entries = Array.from( data.entries() );
		return entries;
	}

	checkMetaBoxState() {
		const { isUpdating, isDirty, changedMetaBoxState, location } = this.props;

		const isStateEqual = isEqual( this.originalFormData, this.getFormData() );

		/**
		 * If we are not updating, then if dirty and equal to original, then set not dirty.
		 * If we are not updating, then if not dirty and not equal to original, set as dirty.
		 */
		if ( ! isUpdating && ( isDirty === isStateEqual ) ) {
			changedMetaBoxState( location, ! isDirty );
		}
	}

	handleMetaBoxReload( event ) {
		// Remove the reloading event listener once the meta box has loaded.
		event.target.removeEventListener( 'load', this.handleMetaBoxReload );

		if ( this.clonedNode ) {
			this.showNode( this.node );
			this.hideNode( this.clonedNode );
			this.clonedNode.removeEventListener( 'load', this.handleDoubleBuffering );
			this.clonedNode.parentNode.removeChild( this.clonedNode );
			delete this.clonedNode;
		}

		this.originalFormData = this.getFormData();
		this.props.metaBoxReloaded( this.props.location );
	}

	checkMessageForResize( event ) {
		const iframe = this.node;

		// Attempt to parse the message data as JSON if passed as string
		let data = event.data || {};
		if ( 'string' === typeof data ) {
			try {
				data = JSON.parse( data );
			} catch ( e ) {} // eslint-disable-line no-empty
		}

		// Check to make sure the meta box matches this location.
		if ( data.source !== 'meta-box' || data.location !== this.props.location ) {
			return;
		}

		// Verify that the mounted element is the source of the message
		if ( ! iframe || iframe.contentWindow !== event.source ) {
			return;
		}

		// Update the state only if the message is formatted as we expect, i.e.
		// as an object with a 'resize' action, width, and height
		const { action, width, height } = data;
		const { width: oldWidth, height: oldHeight } = this.state;

		if ( 'resize' === action && ( oldWidth !== width || oldHeight !== height ) ) {
			this.setState( { width, height } );
		}
	}

	isSaving() {
		const { isUpdating, isDirty, isPostSaving } = this.props;
		return isUpdating || ( isDirty && isPostSaving );
	}

	render() {
		const { location } = this.props;
		const { isOpen } = this.state;
		const isSaving = this.isSaving();

		const classes = classnames(
			'editor-meta-box-iframe',
			location,
			{ 'is-closed': ! isOpen }
		);

		const overlayClasses = classnames(
			'editor-meta-boxes__loading-overlay',
			{ 'is-visible': isSaving }
		);

		const iframeClasses = classnames( { 'is-updating': isSaving } );

		return (
			<Panel className="editor-meta-boxes">
				<MetaBoxPanel
					title={ __( 'Extended Settings' ) }
					opened={ isOpen }
					onToggle={ this.toggle }>
					<div className={ classes }>
						<div className={ overlayClasses }>
							<p className="loading-overlay__text">{ __( 'Updating Settings' ) }</p>
						</div>
						<iframe
							className={ iframeClasses }
							ref={ this.bindNode }
							title={ __( 'Extended Settings' ) }
							src={ addQueryArgs( window._wpMetaBoxUrl, { meta_box: location } ) }
							width={ Math.ceil( this.state.width ) }
							height={ Math.ceil( this.state.height ) } />
					</div>
				</MetaBoxPanel>
			</Panel>
		);
	}
}

export default MetaBoxIframe;
