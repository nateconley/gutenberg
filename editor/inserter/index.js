/**
 * External dependencies
 */
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Component } from '@wordpress/element';
import { Popover, IconButton } from '@wordpress/components';
import { createBlock } from '@wordpress/blocks';

/**
 * Internal dependencies
 */
import InserterMenu from './menu';
import { getBlockInsertionPoint, getEditorMode } from '../selectors';
import {
	insertBlock,
	setBlockInsertionPoint,
	clearBlockInsertionPoint,
	hideInsertionPoint,
} from '../actions';

class Inserter extends Component {
	constructor() {
		super( ...arguments );

		this.toggle = this.toggle.bind( this );
		this.close = this.close.bind( this );
		this.closeOnClickOutside = this.closeOnClickOutside.bind( this );
		this.bindNode = this.bindNode.bind( this );
		this.insertBlock = this.insertBlock.bind( this );

		this.state = {
			opened: false,
		};
	}

	componentWillUpdate( nextProps, nextState ) {
		const { insertIndex, setInsertionPoint, clearInsertionPoint } = nextProps;
		const { opened } = nextState;
		if (
			( this.state.opened !== opened || this.props.insertIndex !== insertIndex ) &&
			Number.isInteger( insertIndex )
		) {
			if ( opened ) {
				setInsertionPoint( insertIndex );
			} else {
				clearInsertionPoint();
			}
		}
	}

	componentWillUnmount() {
		if ( this.state.opened ) {
			this.props.clearInsertionPoint();
		}
	}

	toggle() {
		this.setState( ( state ) => ( {
			opened: ! state.opened,
		} ) );
	}

	close() {
		this.setState( {
			opened: false,
		} );
	}

	closeOnClickOutside( event ) {
		if ( ! this.node.contains( event.target ) ) {
			this.close();
		}
	}

	bindNode( node ) {
		this.node = node;
	}

	insertBlock( name ) {
		const {
			insertionPoint,
			onInsertBlock,
		} = this.props;

		onInsertBlock(
			name,
			insertionPoint
		);

		this.close();
	}

	render() {
		const { opened } = this.state;
		const { position, children } = this.props;

		return (
			<div ref={ this.bindNode } className="editor-inserter">
				<IconButton
					icon="insert"
					label={ __( 'Insert block' ) }
					onClick={ this.toggle }
					className="editor-inserter__toggle"
					aria-haspopup="true"
					aria-expanded={ opened }
				>
					{ children }
				</IconButton>
				<Popover
					isOpen={ opened }
					position={ position }
					onClose={ this.close }
					onClickOutside={ this.closeOnClickOutside }
				>
					<InserterMenu onSelect={ this.insertBlock } />
				</Popover>
			</div>
		);
	}
}

export default connect(
	( state ) => {
		return {
			insertionPoint: getBlockInsertionPoint( state ),
			mode: getEditorMode( state ),
		};
	},
	( dispatch ) => ( {
		onInsertBlock( name, position ) {
			dispatch( hideInsertionPoint() );
			dispatch( insertBlock(
				createBlock( name ),
				position
			) );
		},
		...bindActionCreators( {
			setInsertionPoint: setBlockInsertionPoint,
			clearInsertionPoint: clearBlockInsertionPoint,
		}, dispatch ),
	} )
)( Inserter );
