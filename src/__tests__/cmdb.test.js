import nock from 'nock';
import Cmdb from '../cmdb';
import itemFixture from './fixtures/item.json';
import itemsFixture from './fixtures/items.json';
import relationshipFixture from './fixtures/relationship.json';
import relationshipsFixture from './fixtures/relationships.json';

const defaultApi = 'https://cmdb.in.ft.com/v3/';
const stubType = 'system';
const stubKey = 'dewey';
const stubLocals = {
    s3o_username: 'dummyUsername',
};
const defaultCorsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'apikey,x-api-key,ft-forwarded-auth',
    'Access-Control-Allow-Methods': 'GET,HEAD,POST,PUT,DELETE,OPTIONS',
};

const createCmdb = options =>
    new Cmdb(
        Object.assign(
            { api: defaultApi, apikey: 'dummyApiKey', verbose: true },
            options
        )
    );

const createBaseNockStubWithCors = () =>
    nock(defaultApi).defaultReplyHeaders(defaultCorsHeaders);

const stubCorsPreFlight = () =>
    createBaseNockStubWithCors()
        .options(/.*/)
        .optionally()
        .query(true)
        .reply(200);

const stubItemResponse = (
    { verb = 'get', responseHeaders = {}, body } = {},
    type,
    key,
    [statusCode, response] = [200, JSON.stringify(itemFixture)]
) => {
    const baseNockStub = createBaseNockStubWithCors();
    return baseNockStub[verb](
        `/items/${encodeURIComponent(type)}/${encodeURIComponent(key)}`,
        body
    )
        .query(true)
        .reply(statusCode, response, responseHeaders);
};

const stubItemsResponse = (
    { verb = 'get', responseHeaders = {}, body, query = true } = {},
    type,
    [statusCode, response] = [200, itemsFixture]
) => {
    const mergedResponseHeaders = Object.assign(
        {},
        {
            Count: `Pages: 1, Items: ${response.length}`,
        },
        responseHeaders
    );
    const baseNockStub = createBaseNockStubWithCors();
    const encodedTypePath = type ? `/${encodeURIComponent(type)}` : '';
    return baseNockStub[verb](`/items${encodedTypePath}`, body)
        .query(query)
        .reply(statusCode, JSON.stringify(response), mergedResponseHeaders);
};

const stubRelationshipResponse = (
    { verb, responseHeaders = {} } = {},
    subjectType,
    subjectID,
    relType,
    objectType,
    objectID,
    [statusCode, response] = [200, relationshipFixture]
) => {
    const baseNockStub = createBaseNockStubWithCors();
    return baseNockStub[verb](
        `/relationships/${encodeURIComponent(subjectType)}/${encodeURIComponent(
            subjectID
        )}/${encodeURIComponent(relType)}/${encodeURIComponent(
            objectType
        )}/${encodeURIComponent(objectID)}`
    )
        .query(true)
        .reply(statusCode, JSON.stringify(response), responseHeaders);
};

const stubRelationshipsResponse = (
    { responseHeaders = {} } = {},
    subjectType,
    subjectID,
    relType,
    [statusCode, response] = [200, relationshipsFixture]
) => {
    const baseNockStub = createBaseNockStubWithCors();
    const basePath = `/relationships/${encodeURIComponent(
        subjectType
    )}/${encodeURIComponent(subjectID)}`;
    return baseNockStub
        .get(relType ? `${basePath}/${encodeURIComponent(relType)}` : basePath)
        .query(true)
        .reply(statusCode, JSON.stringify(response), responseHeaders);
};

beforeEach(() => {
    stubCorsPreFlight();
});

afterEach(() => {
    nock.cleanAll();
});

afterAll(() => {
    nock.enableNetConnect();
});

test('The constructor should error if the environment is missing a Promise implementation', () => {
    const oldPromise = Promise;
    global.Promise = undefined;
    try {
        expect(createCmdb).toThrowError(
            'CMD API requires an environment with Promises'
        );
    } finally {
        global.Promise = oldPromise;
    }
});

test('The constructor should error if no apikey is provided', () => {
    expect(() => new Cmdb()).toThrowError(
        "The config parameter 'apikey' is required"
    );
});

describe('getItem', () => {
    test('should require type', async () => {
        expect.assertions(1);

        await expect(() =>
            createCmdb().getItem(stubLocals, undefined, stubKey)
        ).toThrow("The config parameter 'type' is required");
    });

    test('should require key', async () => {
        expect.assertions(1);

        await expect(() =>
            createCmdb().getItem(stubLocals, stubType, undefined)
        ).toThrow("The config parameter 'key' is required");
    });

    test('should call the correct endpoint', async () => {
        expect.assertions(1);
        const givenType = stubType;
        const givenKey = stubKey;
        const stubHttp = stubItemResponse(undefined, givenType, givenKey);

        await createCmdb().getItem(stubLocals, givenType, givenKey);
        expect(stubHttp.isDone()).toBeTruthy();
    });

    test('should return the cmdb response', async () => {
        expect.assertions(1);
        const givenType = stubType;
        const givenKey = stubKey;
        stubItemResponse(undefined, givenType, givenKey);

        await expect(
            createCmdb().getItem(stubLocals, givenType, givenKey)
        ).resolves.toMatchSnapshot();
    });

    [403, 404, 500].forEach(statusCode => {
        test(`should return an error with the statusCode of the failure if the API call returns a ${statusCode}`, async () => {
            expect.assertions(6);
            const givenType = stubType;
            const givenKey = stubKey;
            const givenHeaders = {
                'Content-Type': 'text/html',
            };
            const givenResponseBody = JSON.stringify({
                error: ['some error'],
            });
            stubItemResponse(
                { responseHeaders: givenHeaders },
                givenType,
                givenKey,
                [statusCode, givenResponseBody]
            );

            return createCmdb()
                .getItem(stubLocals, givenType, givenKey)
                .then(response => {
                    throw new Error(
                        `Expected getItem call to reject but it was resolved with ${JSON.stringify(
                            response
                        )}`
                    );
                })
                .catch(error => {
                    expect(error).toHaveProperty(
                        'message',
                        `Received ${statusCode} response from CMDB`
                    );
                    expect(error).toHaveProperty('statusCode', statusCode);
                    expect(error).toHaveProperty('headers');
                    expect(error.headers.get('Content-Type')).toEqual(
                        'text/html'
                    );
                    expect(error).toHaveProperty('body');
                    expect(error.body).toEqual(JSON.parse(givenResponseBody));
                });
        });
    });

    test('should return an error if the response is not OK and the body is not JSON', async () => {
        expect.assertions(5);
        const statusCode = 500;
        const givenType = stubType;
        const givenKey = stubKey;
        const givenHeaders = {
            'Content-Type': 'text/html',
        };
        const givenResponseBody = 'A non-json string {';
        stubItemResponse(
            { responseHeaders: givenHeaders },
            givenType,
            givenKey,
            [statusCode, givenResponseBody]
        );

        return createCmdb()
            .getItem(stubLocals, givenType, givenKey)
            .then(response => {
                throw new Error(
                    `Expected getItem call to reject but it was resolved with ${JSON.stringify(
                        response
                    )}`
                );
            })
            .catch(error => {
                expect(error).toHaveProperty(
                    'message',
                    `Received response with invalid body from CMDB`
                );
                expect(error).toHaveProperty('statusCode', statusCode);
                expect(error).toHaveProperty('headers');
                expect(error.headers.get('Content-Type')).toEqual('text/html');
                expect(error.body).not.toBeDefined();
            });
    });
});

describe('getItemFields', () => {
    const setupGetItemFields = (...args) =>
        stubItemResponse(undefined, ...args);

    test('should require type', async () => {
        expect.assertions(1);

        await expect(() =>
            createCmdb().getItemFields(stubLocals, undefined, stubKey)
        ).toThrow("The config parameter 'type' is required");
    });

    test('should require key', async () => {
        expect.assertions(1);

        await expect(() =>
            createCmdb().getItemFields(stubLocals, stubType, undefined)
        ).toThrow("The config parameter 'key' is required");
    });

    test('should call the correct endpoint', async () => {
        expect.assertions(1);
        const givenType = stubType;
        const givenKey = stubKey;
        const stubHttp = setupGetItemFields(givenType, givenKey);

        await createCmdb().getItemFields(stubLocals, givenType, givenKey);
        expect(stubHttp.isDone()).toBeTruthy();
    });

    test('should return the cmdb response', async () => {
        expect.assertions(1);
        const givenType = stubType;
        const givenKey = stubKey;
        setupGetItemFields(givenType, givenKey);

        await expect(
            createCmdb().getItemFields(stubLocals, givenType, givenKey)
        ).resolves.toMatchSnapshot();
    });
});

describe('putItem', () => {
    const dummyBody = {};
    const setupPutItem = (...args) =>
        stubItemResponse({ verb: 'put' }, ...args);

    test('should require type', async () => {
        expect.assertions(1);

        await expect(() =>
            createCmdb().putItem(stubLocals, undefined, stubKey, dummyBody)
        ).toThrow("The config parameter 'type' is required");
    });

    test('should require body', async () => {
        expect.assertions(1);

        await expect(() =>
            createCmdb().putItem(stubLocals, stubType, stubKey, undefined)
        ).toThrow("The config parameter 'body' is required");
    });

    test('should require key', async () => {
        expect.assertions(1);

        await expect(() =>
            createCmdb().putItem(stubLocals, stubType, undefined, dummyBody)
        ).toThrow("The config parameter 'key' is required");
    });

    test('should call the correct endpoint', async () => {
        expect.assertions(1);
        const givenType = stubType;
        const givenKey = stubKey;
        const stubHttp = setupPutItem(givenType, givenKey);

        await createCmdb().putItem(stubLocals, givenType, givenKey, dummyBody);
        expect(stubHttp.isDone()).toBeTruthy();
    });

    test('should return the cmdb response', async () => {
        expect.assertions(1);
        const givenType = stubType;
        const givenKey = stubKey;
        setupPutItem(givenType, givenKey);

        await expect(
            createCmdb().putItem(stubLocals, givenType, givenKey, dummyBody)
        ).resolves.toMatchSnapshot();
    });
});

describe('deleteItem', () => {
    const setupDeleteItem = (...args) =>
        stubItemResponse({ verb: 'delete' }, ...args);

    test('should require type', async () => {
        expect.assertions(1);

        await expect(() =>
            createCmdb().deleteItem(stubLocals, undefined, stubKey)
        ).toThrow("The config parameter 'type' is required");
    });

    test('should require key', async () => {
        expect.assertions(1);

        await expect(() =>
            createCmdb().deleteItem(stubLocals, stubType, undefined)
        ).toThrow("The config parameter 'key' is required");
    });

    test('should call the correct endpoint', async () => {
        expect.assertions(1);
        const givenType = stubType;
        const givenKey = stubKey;
        const stubHttp = setupDeleteItem(givenType, givenKey);

        await createCmdb().deleteItem(stubLocals, givenType, givenKey);
        expect(stubHttp.isDone()).toBeTruthy();
    });

    test('should return the cmdb response', async () => {
        expect.assertions(1);
        const givenType = stubType;
        const givenKey = stubKey;
        setupDeleteItem(givenType, givenKey);

        await expect(
            createCmdb().deleteItem(stubLocals, givenType, givenKey)
        ).resolves.toMatchSnapshot();
    });
});

describe('getAllItems', () => {
    const stubGetAllItems = (...args) => stubItemsResponse(undefined, ...args);

    test('should not require type', async () => {
        expect.assertions(1);
        stubGetAllItems();

        await expect(() =>
            createCmdb().getAllItems(stubLocals, undefined)
        ).not.toThrow();
    });

    test('should call the endpoint for the given type if provided', async () => {
        expect.assertions(1);
        const stubHttp = stubGetAllItems(stubType);

        await createCmdb().getAllItems(stubLocals, stubType);
        expect(stubHttp.isDone()).toBeTruthy();
    });

    test('should call the endpoint to get all types if no type is given', async () => {
        expect.assertions(1);
        const stubHttp = stubGetAllItems();

        await createCmdb().getAllItems(stubLocals);
        expect(stubHttp.isDone()).toBeTruthy();
    });

    test('should return the cmdb response', async () => {
        expect.assertions(1);
        stubGetAllItems(stubType);

        await expect(
            createCmdb().getAllItems(stubLocals, stubType)
        ).resolves.toMatchSnapshot();
    });

    it('should traverse pagination correctly', async () => {
        expect.assertions(4);
        const stubPage1 = stubItemsResponse({
            responseHeaders: {
                Link: `<${defaultApi}items?limit=20&page=2>; rel="next"`,
            },
            query: {
                limit: 20,
            },
        });
        const stubPage2 = stubItemsResponse({
            responseHeaders: {
                Link: `<${defaultApi}items?limit=20&page=3>; rel="next"`,
            },
            query: { page: 2, limit: 20 },
        });
        const stubPage3WithNoLink = stubItemsResponse({
            query: { page: 3, limit: 20 },
        });
        const stubPage4 = stubItemsResponse({ query: { page: 4, limit: 20 } });

        await createCmdb().getAllItems(stubLocals, undefined, undefined, 20);

        expect(stubPage1.isDone()).toBeTruthy();
        expect(stubPage2.isDone()).toBeTruthy();
        expect(stubPage3WithNoLink.isDone()).toBeTruthy();
        expect(stubPage4.isDone()).not.toBeTruthy();
    });

    it('should return the paginated records as a single array', async () => {
        expect.assertions(2);
        stubItemsResponse(
            {
                responseHeaders: {
                    Link: `<${defaultApi}items?limit=20&page=2>; rel="next"`,
                },
                query: {
                    limit: 20,
                },
            },
            undefined,
            [200, itemsFixture.slice(0, 1)]
        );
        stubItemsResponse(
            {
                responseHeaders: {
                    Link: `<${defaultApi}items?limit=20&page=3>; rel="next"`,
                },
                query: { page: 2, limit: 20 },
            },
            undefined,
            [200, itemsFixture.slice(1, 2)]
        );
        stubItemsResponse(
            {
                query: { page: 3, limit: 20 },
            },
            undefined,
            [200, itemsFixture.slice(2, 3)]
        );

        const response = await createCmdb().getAllItems(
            stubLocals,
            undefined,
            undefined,
            20
        );

        expect(response).toHaveLength(3);
        expect(response).toEqual(itemsFixture.slice(0, 3));
    });
});

describe('getAllItemFields', () => {
    const stubGetAllItemFields = (...args) =>
        stubItemsResponse(undefined, ...args);

    test('should require type', async () => {
        expect.assertions(1);

        await expect(() =>
            createCmdb().getAllItemFields(stubLocals, undefined)
        ).toThrow("The config parameter 'type' is required");
    });

    test('should call the correct endpoint', async () => {
        expect.assertions(1);
        const stubHttp = stubGetAllItemFields(stubType);

        await createCmdb().getAllItemFields(stubLocals, stubType);
        expect(stubHttp.isDone()).toBeTruthy();
    });

    test('should return the cmdb response', async () => {
        expect.assertions(1);
        stubGetAllItemFields(stubType);

        await expect(
            createCmdb().getAllItemFields(stubLocals, stubType)
        ).resolves.toMatchSnapshot();
    });
});

describe('getItemCount', () => {
    const stubGetItemCount = (...args) => stubItemsResponse(undefined, ...args);

    test('should require type', async () => {
        expect.assertions(1);

        await expect(() =>
            createCmdb().getItemCount(stubLocals, undefined)
        ).toThrow("The config parameter 'type' is required");
    });

    test('should call the correct endpoint', async () => {
        expect.assertions(1);
        const stubHttp = stubGetItemCount(stubType);

        await createCmdb().getItemCount(stubLocals, stubType);
        expect(stubHttp.isDone()).toBeTruthy();
    });

    test('should return the cmdb response', async () => {
        expect.assertions(1);
        stubGetItemCount(stubType);

        await expect(
            createCmdb().getItemCount(stubLocals, stubType)
        ).resolves.toEqual({
            pages: 1,
            items: 4,
        });
    });
});

describe('getItemPage', () => {
    const stubGetItemPage = (...args) => stubItemsResponse(undefined, ...args);

    test('should require type', async () => {
        expect.assertions(1);

        await expect(() =>
            createCmdb().getItemPage(stubLocals, undefined)
        ).toThrow("The config parameter 'type' is required");
    });

    test('should call the correct endpoint', async () => {
        expect.assertions(1);
        const stubHttp = stubGetItemPage(stubType);

        await createCmdb().getItemPage(stubLocals, stubType);
        expect(stubHttp.isDone()).toBeTruthy();
    });

    test('should return the cmdb response', async () => {
        expect.assertions(1);
        stubGetItemPage(stubType);

        await expect(
            createCmdb().getItemPage(stubLocals, stubType)
        ).resolves.toMatchSnapshot();
    });
});

describe('getItemPageFields', () => {
    const stubGetItemPageFields = (...args) =>
        stubItemsResponse(undefined, ...args);

    test('should require type', async () => {
        expect.assertions(1);

        await expect(() =>
            createCmdb().getItemPageFields(stubLocals, undefined)
        ).toThrow("The config parameter 'type' is required");
    });

    test('should call the correct endpoint', async () => {
        expect.assertions(1);
        const stubHttp = stubGetItemPageFields(stubType);

        await createCmdb().getItemPageFields(stubLocals, stubType);
        expect(stubHttp.isDone()).toBeTruthy();
    });

    test('should return the cmdb response', async () => {
        expect.assertions(1);
        stubGetItemPageFields(stubType);

        await expect(
            createCmdb().getItemPageFields(stubLocals, stubType)
        ).resolves.toMatchSnapshot();
    });
});

describe('getRelationships', () => {
    const dummySubjectType = 'system';
    const dummySubjectID = 'dewey';
    const dummyRelType = 'primaryContactFor';

    test('should require subjectType', async () => {
        expect.assertions(1);

        await expect(() =>
            createCmdb().getRelationships(stubLocals, undefined)
        ).toThrow("The config parameter 'subjectType' is required");
    });

    test('should require subjectID', async () => {
        expect.assertions(1);

        await expect(() =>
            createCmdb().getRelationships(stubLocals, dummySubjectType)
        ).toThrow("The config parameter 'subjectID' is required");
    });

    test('should call the correct endpoint when the relationship type is specified', async () => {
        expect.assertions(1);
        const stubHttp = stubRelationshipsResponse(
            undefined,
            dummySubjectType,
            dummySubjectID,
            dummyRelType
        );

        await createCmdb().getRelationships(
            stubLocals,
            dummySubjectType,
            dummySubjectID,
            dummyRelType
        );
        expect(stubHttp.isDone()).toBeTruthy();
    });

    test('should return the cmdb response when the relationship type is specified', async () => {
        expect.assertions(1);
        stubRelationshipsResponse(
            undefined,
            dummySubjectType,
            dummySubjectID,
            dummyRelType
        );

        await expect(
            createCmdb().getRelationships(
                stubLocals,
                dummySubjectType,
                dummySubjectID,
                dummyRelType
            )
        ).resolves.toMatchSnapshot();
    });

    test('should call the correct endpoint when the relationship type is not specified', async () => {
        expect.assertions(1);
        const stubHttp = stubRelationshipsResponse(
            undefined,
            dummySubjectType,
            dummySubjectID
        );

        await createCmdb().getRelationships(
            stubLocals,
            dummySubjectType,
            dummySubjectID
        );
        expect(stubHttp.isDone()).toBeTruthy();
    });

    test('should return the cmdb response when the relationship type is not specified', async () => {
        expect.assertions(1);
        stubRelationshipsResponse(undefined, dummySubjectType, dummySubjectID);

        await expect(
            createCmdb().getRelationships(
                stubLocals,
                dummySubjectType,
                dummySubjectID
            )
        ).resolves.toMatchSnapshot();
    });
});

[
    { method: 'putRelationship', verb: 'post' },
    { method: 'getRelationship', verb: 'get' },
    { method: 'deleteRelationship', verb: 'delete' },
].forEach(({ method, verb }) => {
    describe(method, () => {
        const dummySubjectType = 'system';
        const dummySubjectID = 'dewey';
        const dummyRelType = 'primaryContactFor';
        const dummyObjectType = 'contact';
        const dummyObjectID = 'someone';

        test('should require subjectType', async () => {
            expect.assertions(1);

            await expect(() =>
                createCmdb()[method](stubLocals, undefined)
            ).toThrow("The config parameter 'subjectType' is required");
        });

        test('should require subjectID', async () => {
            expect.assertions(1);

            await expect(() =>
                createCmdb()[method](stubLocals, dummySubjectType)
            ).toThrow("The config parameter 'subjectID' is required");
        });

        test('should require relType', async () => {
            expect.assertions(1);

            await expect(() =>
                createCmdb()[method](
                    stubLocals,
                    dummySubjectType,
                    dummySubjectID
                )
            ).toThrow("The config parameter 'relType' is required");
        });

        test('should require objectType', async () => {
            expect.assertions(1);

            await expect(() =>
                createCmdb()[method](
                    stubLocals,
                    dummySubjectType,
                    dummySubjectID,
                    dummyObjectType
                )
            ).toThrow("The config parameter 'objectType' is required");
        });

        test('should require objectID', async () => {
            expect.assertions(1);

            await expect(() =>
                createCmdb()[method](
                    stubLocals,
                    dummySubjectType,
                    dummySubjectID,
                    dummyRelType,
                    dummyObjectType
                )
            ).toThrow("The config parameter 'objectID' is required");
        });

        test('should call the correct endpoint', async () => {
            expect.assertions(1);
            const stubHttp = stubRelationshipResponse(
                { verb },
                dummySubjectType,
                dummySubjectID,
                dummyRelType,
                dummyObjectType,
                dummyObjectID
            );

            await createCmdb()[method](
                stubLocals,
                dummySubjectType,
                dummySubjectID,
                dummyRelType,
                dummyObjectType,
                dummyObjectID
            );
            expect(stubHttp.isDone()).toBeTruthy();
        });
        test('should return the cmdb response', async () => {
            expect.assertions(1);
            stubRelationshipResponse(
                { verb },
                dummySubjectType,
                dummySubjectID,
                dummyRelType,
                dummyObjectType,
                dummyObjectID
            );

            await expect(
                createCmdb()[method](
                    stubLocals,
                    dummySubjectType,
                    dummySubjectID,
                    dummyRelType,
                    dummyObjectType,
                    dummyObjectID
                )
            ).resolves.toMatchSnapshot();
        });
    });
});
