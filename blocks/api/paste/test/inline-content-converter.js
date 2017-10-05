/**
 * External dependencies
 */
import { equal } from 'assert';

/**
 * Internal dependencies
 */
import inlineContentConverter from '../inline-content-converter';
import { deepFilter } from '../utils';

describe( 'inlineContentConverter', () => {
	it( 'should remove non-inline content from inline wrapper', () => {
		equal(
			deepFilter( '<figcaption><p>test</p><p>test</p></figcaption>', [ inlineContentConverter ] ),
			'<figcaption>test<br>test</figcaption>'
		);
	} );
} );
