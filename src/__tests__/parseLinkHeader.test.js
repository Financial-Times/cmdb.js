import parseLinkHeader from '../parseLinkHeader'

describe('Parse link header', () => {
    test('should return an empty object if the given header is falsey', () => {
        expect(parseLinkHeader(undefined)).toEqual({})
    })

    test('should return an empty object if the given header is an empty string', () => {
        expect(parseLinkHeader('')).toEqual({})
    })

    test('The constructor should error if the environment is missing a Promise implementation', () => {
        const givenLinkHeader = [
            '<https://api.github.com/user/9287/repos?page=3&per_page=100>; rel="next"',
            '<https://api.github.com/user/9287/repos?page=1&per_page=100>; rel="prev"; pet="cat"',
            '<https://api.github.com/user/9287/repos?page=5&per_page=100>; rel="last"',
        ].join(', ')
        const expectedParseHeader = {
            next: 'https://api.github.com/user/9287/repos?page=3&per_page=100',
            prev: 'https://api.github.com/user/9287/repos?page=1&per_page=100',
            last: 'https://api.github.com/user/9287/repos?page=5&per_page=100',
        }

        expect(parseLinkHeader(givenLinkHeader)).toEqual(expectedParseHeader)
    })
})
