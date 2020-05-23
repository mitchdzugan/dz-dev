import React, {PureComponent} from 'react';
import {Color, StdinContext} from 'ink';
import chalk from 'chalk';

const ARROW_LEFT = '\u001B[D';
const ARROW_RIGHT = '\u001B[C';
const BACKSPACE = '\x08';
const DELETE = '\x7F';

class TextInput extends PureComponent {
	static defaultProps = {
		placeholder: '',
		showCursor: true,
		focus: true,
		mask: undefined,
		highlightPastedText: false,
		onSubmit: undefined
	};

	state = {
		cursorOffset: (this.props.value || '').length,
		cursorWidth: 0
	}

	isMounted = false;

	render() {
		const {value, placeholder, showCursor, focus, mask, highlightPastedText} = this.props;
		const {cursorOffset, cursorWidth} = this.state;
		const hasValue = value.length > 0;
		let renderedValue = value;
		const cursorActualWidth = highlightPastedText ? cursorWidth : 0;

		// Fake mouse cursor, because it's too inconvenient to deal with actual cursor and ansi escapes
		if (showCursor && !mask && focus) {
			renderedValue = value.length > 0 ? '' : chalk.inverse(' ');

			let i = 0;
			for (const char of value) {
				if (i >= cursorOffset - cursorActualWidth && i <= cursorOffset) {
					renderedValue += chalk.inverse(char);
				} else {
					renderedValue += char;
				}

				i++;
			}

			if (value.length > 0 && cursorOffset === value.length) {
				renderedValue += chalk.inverse(' ');
			}
		}

		if (mask) {
			renderedValue = mask.repeat(renderedValue.length);
		}

		return (
			<Color dim={!hasValue && placeholder}>
				{placeholder ? (hasValue ? renderedValue : placeholder) : renderedValue}
			</Color>
		);
	}

	componentDidMount() {
		const {stdin, setRawMode} = this.props;

		this.isMounted = true;
    setTimeout(
      () => {
		    setRawMode(true);
		    stdin.on('data', this.handleInput);
      },
      1000
    );
	}

	componentWillUnmount() {
		const {stdin, setRawMode} = this.props;

		this.isMounted = false;
		stdin.removeListener('data', this.handleInput);
		setRawMode(false);
	}

	handleInput = data => {
		const {value: originalValue, focus, showCursor, mask, onChange, onSubmit} = this.props;
		const {cursorOffset: originalCursorOffset} = this.state;

		if (focus === false || this.isMounted === false) {
			return;
		}

		const s = String(data);

    if (!this.props.onKey(s)) {
      return;
    };

		let cursorOffset = originalCursorOffset;
		let value = originalValue;
		let cursorWidth = 0;

		if (s === ARROW_LEFT) {
			if (showCursor && !mask) {
				cursorOffset--;
			}
		} else if (s === ARROW_RIGHT) {
			if (showCursor && !mask) {
				cursorOffset++;
			}
		} else if (s === BACKSPACE || s === DELETE) {
			value = value.slice(0, cursorOffset - 1) + value.slice(cursorOffset, value.length);
			cursorOffset--;
		} else {
			value = value.slice(0, cursorOffset) + s + value.slice(cursorOffset, value.length);
			cursorOffset += s.length;

			if (s.length > 1) {
				cursorWidth = s.length;
			}
		}

		if (cursorOffset < 0) {
			cursorOffset = 0;
		}

		if (cursorOffset > value.length) {
			cursorOffset = value.length;
		}

		this.setState({cursorOffset, cursorWidth});

		if (value !== originalValue) {
			onChange(value);
		}
	}
}

export default class TextInputWithStdin extends PureComponent {
	render() {
		return (
			<StdinContext.Consumer>
				{({stdin, setRawMode}) => (
					<TextInput {...this.props} stdin={stdin} setRawMode={setRawMode}/>
				)}
			</StdinContext.Consumer>
		);
	}
}

export class UncontrolledTextInput extends PureComponent {
	state = {
		value: ''
	}

	setValue(value) {
		this.setState({value});
	}

	setValue = this.setValue.bind(this);

	render() {
		return <TextInputWithStdin {...this.props} value={this.state.value} onChange={this.setValue}/>;
	}
}
