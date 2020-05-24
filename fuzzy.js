import fuzzy from 'fuzzy';
import _ from 'lodash';

const pre = ";;;;";
const post = "::::";

const sortBy = _.sortBy;

const filter = (input, list, extract = a => a) => {
	return sortBy(
		fuzzy
			.filter(input, list, { pre, post, extract })
			.map(({ string, ...match }) => {
				const pieces = string
							.split(pre)
							.map(partial => partial.split(post))
							.map(matchParts => matchParts.map((part, i) => ({
								part, matches: i === 0 && matchParts.length > 1
							})))
							.flat()
							.filter(({ part }) => part !== "");
				return { ...match, pieces };
			}),
		'index'
	);
};

export default filter;
