import {
  clearSelection,
  comparePosition
} from '../utils/selection-utils';
import { containsNode } from '../utils/dom-utils';
import Position from './cursor/position';
import Range from './cursor/range';
import { DIRECTION } from '../utils/key';

export { Position, Range };

const Cursor = class Cursor {
  constructor(editor) {
    this.editor = editor;
    this.renderTree = editor._renderTree;
    this.post = editor.post;
  }

  clearSelection() {
    clearSelection();
  }

  /**
   * @return {Boolean} true when there is either a collapsed cursor in the
   * editor's element or a selection that is contained in the editor's element
   */
  hasCursor() {
    return this._hasCollapsedSelection() || this._hasSelection();
  }

  hasSelection() {
    return this._hasSelection();
  }

  /**
   * @return {Boolean} Can the cursor be on this element?
   */
  isAddressable(element) {
    let { renderTree } = this;
    let renderNode = renderTree.findRenderNodeFromElement(element);
    if (renderNode && renderNode.postNode.isCardSection) {
      let renderedElement = renderNode.element;

      // card sections have addressable text nodes containing &zwnj;
      // as their first and last child
      if (element !== renderedElement &&
          element !== renderedElement.firstChild &&
          element !== renderedElement.lastChild) {
        return false;
      }
    }

    return !!renderNode;
  }

  /*
   * @return {Range} Cursor#Range object
   */
  get offsets() {
    if (!this.hasCursor()) { return Range.emptyRange(); }

    const { selection, renderTree } = this;

    const {
      headNode, headOffset, tailNode, tailOffset, direction
    } = comparePosition(selection);

    const headPosition = Position.fromNode(renderTree, headNode, headOffset);
    const tailPosition = Position.fromNode(renderTree, tailNode, tailOffset);

    return new Range(headPosition, tailPosition, direction);
  }

  get activeSections() {
    if (!this.hasCursor()) { return []; }

    const {head, tail} = this.offsets;
    return this.post.sections.readRange(head.section, tail.section);
  }

  // moves cursor to the start of the section
  moveToSection(section, offsetInSection=0) {
    this.moveToPosition(new Position(section, offsetInSection));
  }

  selectSections(sections) {
    const headSection = sections[0], tailSection = sections[sections.length - 1];
    const range = Range.create(headSection, 0, tailSection, tailSection.length);
    this.selectRange(range);
  }

  _findNodeForPosition(position) {
    const { section } = position;
    let node, offset;
    if (section.isCardSection) {
      offset = 0;
      if (position.offset === 0) {
        node = section.renderNode.element.firstChild;
      } else {
        node = section.renderNode.element.lastChild;
      }
    } else if (section.isBlank) {
      node = section.renderNode.element;
      offset = 0;
    } else {
      const {marker, offsetInMarker} = position;
      node = marker.renderNode.element;
      offset = offsetInMarker;
    }

    return {node, offset};
  }

  selectRange(range) {
    const { head, tail, direction } = range;
    const { node:headNode, offset:headOffset } = this._findNodeForPosition(head),
          { node:tailNode, offset:tailOffset } = this._findNodeForPosition(tail);
    this._moveToNode(headNode, headOffset, tailNode, tailOffset, direction);
  }

  get selection() {
    return window.getSelection();
  }

  selectedText() {
    return this.selection.toString();
  }

  moveToPosition(position) {
    this.selectRange(new Range(position, position));
  }

  /**
   * @param {textNode} node
   * @param {integer} offset
   * @param {textNode} endNode
   * @param {integer} endOffset
   * @param {integer} direction forward or backward, default forward
   * @private
   */
  _moveToNode(node, offset, endNode, endOffset, direction=DIRECTION.FORWARD) {
    this.clearSelection();

    if (direction === DIRECTION.BACKWARD) {
      [node, offset, endNode, endOffset] = [ endNode, endOffset, node, offset ];
    }

    const range = document.createRange();
    range.setStart(node, offset);
    if (direction === DIRECTION.BACKWARD && !!this.selection.extend) {
      this.selection.addRange(range);
      this.selection.extend(endNode, endOffset);
    } else {
      range.setEnd(endNode, endOffset);
      this.selection.addRange(range);
    }
  }

  _hasSelection() {
    const element = this.editor.element;
    const { _selectionRange } = this;
    if (!_selectionRange || _selectionRange.collapsed) { return false; }

    return containsNode(element, this.selection.anchorNode) &&
           containsNode(element, this.selection.focusNode);
  }

  _hasCollapsedSelection() {
    const { _selectionRange } = this;
    if (!_selectionRange) { return false; }

    const element = this.editor.element;
    return containsNode(element, this.selection.anchorNode);
  }

  get _selectionRange() {
    const { selection } = this;
    if (selection.rangeCount === 0) { return null; }
    return selection.getRangeAt(0);
  }
};

export default Cursor;
