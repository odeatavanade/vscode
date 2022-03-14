/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from 'vs/base/browser/dom';
import * as languages from 'vs/editor/common/languages';
import { Emitter, Event } from 'vs/base/common/event';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IRange } from 'vs/editor/common/core/range';
import { CommentMenus } from 'vs/workbench/contrib/comments/browser/commentMenus';
import { CommentNode } from 'vs/workbench/contrib/comments/browser/commentNode';
import { ICommentService } from 'vs/workbench/contrib/comments/browser/commentService';
import { CommentThreadHeader } from 'vs/workbench/contrib/comments/browser/commentThreadHeader';
import { ICellViewModel, INotebookEditorDelegate } from 'vs/workbench/contrib/notebook/browser/notebookBrowser';
import { CellViewModelStateChangeEvent } from 'vs/workbench/contrib/notebook/browser/notebookViewEvents';
import { CellPart } from 'vs/workbench/contrib/notebook/browser/view/cellParts/cellPart';
import { BaseCellRenderTemplate } from 'vs/workbench/contrib/notebook/browser/view/notebookRenderingCommon';
import { CellKind } from 'vs/workbench/contrib/notebook/common/notebookCommon';
import { CodeCellViewModel } from 'vs/workbench/contrib/notebook/browser/viewModel/codeCellViewModel';
import { MarkdownRenderer } from 'vs/editor/contrib/markdownRenderer/browser/markdownRenderer';

export class TestCommentThread implements languages.CommentThread {
	private _input?: languages.CommentInput;
	get input(): languages.CommentInput | undefined {
		return this._input;
	}

	set input(value: languages.CommentInput | undefined) {
		this._input = value;
		this._onDidChangeInput.fire(value);
	}

	private readonly _onDidChangeInput = new Emitter<languages.CommentInput | undefined>();
	get onDidChangeInput(): Event<languages.CommentInput | undefined> { return this._onDidChangeInput.event; }

	private _label: string | undefined;

	get label(): string | undefined {
		return this._label;
	}

	set label(label: string | undefined) {
		this._label = label;
		this._onDidChangeLabel.fire(this._label);
	}

	private _contextValue: string | undefined;

	get contextValue(): string | undefined {
		return this._contextValue;
	}

	set contextValue(context: string | undefined) {
		this._contextValue = context;
	}

	private readonly _onDidChangeLabel = new Emitter<string | undefined>();
	readonly onDidChangeLabel: Event<string | undefined> = this._onDidChangeLabel.event;

	private _comments: languages.Comment[] | undefined;

	public get comments(): languages.Comment[] | undefined {
		return this._comments;
	}

	public set comments(newComments: languages.Comment[] | undefined) {
		this._comments = newComments;
		this._onDidChangeComments.fire(this._comments);
	}

	private readonly _onDidChangeComments = new Emitter<languages.Comment[] | undefined>();
	get onDidChangeComments(): Event<languages.Comment[] | undefined> { return this._onDidChangeComments.event; }

	set range(range: IRange) {
		this._range = range;
		this._onDidChangeRange.fire(this._range);
	}

	get range(): IRange {
		return this._range;
	}

	private readonly _onDidChangeCanReply = new Emitter<boolean>();
	get onDidChangeCanReply(): Event<boolean> { return this._onDidChangeCanReply.event; }
	set canReply(state: boolean) {
		this._canReply = state;
		this._onDidChangeCanReply.fire(this._canReply);
	}

	get canReply() {
		return this._canReply;
	}

	private readonly _onDidChangeRange = new Emitter<IRange>();
	public onDidChangeRange = this._onDidChangeRange.event;

	private _collapsibleState: languages.CommentThreadCollapsibleState | undefined;
	get collapsibleState() {
		return this._collapsibleState;
	}

	set collapsibleState(newState: languages.CommentThreadCollapsibleState | undefined) {
		this._collapsibleState = newState;
		this._onDidChangeCollasibleState.fire(this._collapsibleState);
	}

	private readonly _onDidChangeCollasibleState = new Emitter<languages.CommentThreadCollapsibleState | undefined>();
	public onDidChangeCollasibleState = this._onDidChangeCollasibleState.event;

	private _isDisposed: boolean;

	get isDisposed(): boolean {
		return this._isDisposed;
	}

	constructor(
		public commentThreadHandle: number,
		public controllerHandle: number,
		public extensionId: string,
		public threadId: string,
		public resource: string,
		private _range: IRange,
		private _canReply: boolean
	) {
		this._isDisposed = false;
	}

	dispose() {
		this._isDisposed = true;
		this._onDidChangeCollasibleState.dispose();
		this._onDidChangeComments.dispose();
		this._onDidChangeInput.dispose();
		this._onDidChangeLabel.dispose();
		this._onDidChangeRange.dispose();
	}
}

export class CellComments extends CellPart {
	private _initialized: boolean = false;
	private _header: CommentThreadHeader | null = null;
	private _commentsElement!: HTMLElement;
	private _commentNodes: CommentNode[] = [];
	private _commentMenus: CommentMenus;
	private currentElement: CodeCellViewModel | undefined;

	constructor(
		private readonly notebookEditor: INotebookEditorDelegate,
		private readonly container: HTMLElement,
		@ICommentService private commentService: ICommentService,

		@IContextKeyService private readonly contextKeyService: IContextKeyService,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super();

		this._commentMenus = this.commentService.getCommentMenus(this.notebookEditor.getId());
	}

	_initialize(element: ICellViewModel) {
		if (this._initialized) {
			return;
		}

		this._initialized = true;
		const commentThread = new TestCommentThread(
			element.handle,
			0,
			'',
			'test',
			element.uri.toString(),
			{ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 },
			false
		);
		commentThread.label = 'Discussion';

		commentThread.comments = [
			{
				body: '#test',
				uniqueIdInThread: 1,
				userName: 'rebornix',
				userIconPath: 'https://avatars.githubusercontent.com/u/876920?v%3D4'
			},
			{
				body: 'yet another test',
				uniqueIdInThread: 2,
				userName: 'peng',
				label: 'pending',
				userIconPath: 'https://avatars.githubusercontent.com/u/876920?v%3D4'
			}
		];

		this._header = new CommentThreadHeader(this.container, {
			collapse: () => {
			}
		}, this._commentMenus, commentThread, this.contextKeyService, this.instantiationService);

		const bodyElement = dom.append(this.container, dom.$('.body'));
		this._commentsElement = dom.append(bodyElement, dom.$('div.comments-container'));

		const markdownRenderer = this._register(this.instantiationService.createInstance(MarkdownRenderer, {}));
		this._commentNodes = [];
		if (commentThread.comments) {
			for (const comment of commentThread.comments) {
				const newCommentNode = this.instantiationService.createInstance(CommentNode,
					commentThread,
					comment,
					`${element.handle}`,
					element.uri,
					{
						submitComment: async () => { },
						collapse: () => { }
					},
					markdownRenderer
				);

				this._commentNodes.push(newCommentNode);
				this._commentsElement.appendChild(newCommentNode.domNode);
				if (comment.mode === languages.CommentMode.Editing) {
					newCommentNode.switchToEditMode();
				}
			}
		}
	}

	renderCell(element: ICellViewModel, templateData: BaseCellRenderTemplate): void {
		if (element.cellKind === CellKind.Code) {
			this.currentElement = element as CodeCellViewModel;
			this._initialize(element);
		}
	}

	prepareLayout(): void {
		if (this.currentElement?.cellKind === CellKind.Code) {
			this.currentElement.commentHeight = 25 + dom.getClientArea(this._commentsElement).height;
		}
	}

	updateInternalLayoutNow(element: ICellViewModel): void {

	}
	updateState(element: ICellViewModel, e: CellViewModelStateChangeEvent): void {

	}

}
