import _ from 'lodash';
import React from 'react';
import { render, Color, Box } from 'ink';
import useStdoutDimensions from 'ink-use-stdout-dimensions';
import clear from 'clear';
import TextInput from './TextInput';

const CTRL_C = '\x03';
const ESC = '\x1B';
const ENTER = '\r';
const ARROW_UP = '\u001B[A';
const ARROW_DOWN = '\u001B[B';

const Demo = () => {
  const [rerender, setRerender] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [highlight, setHighlight] = React.useState(0);
  const onKey = (k) => {
    if (k === CTRL_C) {
      return false;
    }
    else if (k === ENTER) {
      return false;
    }
    else if (k === ARROW_UP) {
      setHighlight(highlight - 1);
      return false;
    }
    else if (k === ARROW_DOWN) {
      setHighlight(highlight + 1);
      return false;
    }
    else if (k === ESC) {
      return false;
    }

    return true;
  };

  const items = [
    {text: "abc"},
    {text: "xD"},
    {text: "this is it"},
    {text: "a thing"},
    {text: "lol lmao"},
    {text: "weeeowwww"},
    {text: "what a cool thing"},
    {text: "i made"}
  ];

  const [columns, rows] = useStdoutDimensions();
  React.useEffect(
    () => {
      clear();
      setRerender(!rerender);
    },
    [columns, rows]
  );

  return (
    <Box top={0} height="100%" width="100%" flexDirection="column">
      <Box top={0} height={1} width="100%" flexDirection="row" >
					<Box>
						{rerender ? " " : "/"}
						{"> "}
					</Box>
					<TextInput onKey={onKey} value={input} onChange={setInput} />
      </Box>
      <Color bold white bgRed >
        {"   Find File"}
        {_.range(columns - 12).map(() => " ")}
      </Color>
      {items.map(({ text }, i) => (
        <Color
          {...(Object.assign(
            {},
            { key: i },
            highlight === i ? { bgBlack: true } : {}
          ))}
        >
          {" "}
					{text}
          {_.range(columns - text.length - 1).map(() => " ")}
        </Color>
      ))}
    </Box>
  );
};

export default () => render(<Demo />);
