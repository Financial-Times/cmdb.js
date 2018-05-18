import nock from 'nock';
import Cmdb from '../cmdb';
import itemFixture from './fixtures/item.json';
import itemsFixture from './fixtures/items.json';
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
    new Cmdb(Object.assign({ apikey: 'dummyApiKey', verbose: true }, options));

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
    [statusCode, response] = [200, itemFixture]
) => {
    const baseNockStub = createBaseNockStubWithCors();
    return baseNockStub[verb](
        `/items/${encodeURIComponent(type)}/${encodeURIComponent(key)}`,
        body
    )
        .query(true)
        .reply(statusCode, JSON.stringify(response), responseHeaders);
};

const stubItemsResponse = (
    { verb = 'get', responseHeaders = {}, body } = {},
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
    return baseNockStub[verb](`/items/${encodeURIComponent(type)}`, body)
        .query(true)
        .reply(statusCode, JSON.stringify(response), mergedResponseHeaders);
};

const stubRelationshipsResponse = (
    { verb, responseHeaders = {} } = {},
    subjectType,
    subjectID,
    relType,
    objectType,
    objectID,
    [statusCode, response] = [200, relationshipsFixture]
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

        try {
            await createCmdb().getItem(stubLocals, givenType, givenKey);
        } finally {
            expect(stubHttp.isDone()).toBeTruthy();
        }
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
            expect.assertions(4);
            const givenType = stubType;
            const givenKey = stubKey;
            const givenHeaders = {
                'Content-Type': 'text/html',
            };
            stubItemResponse(
                { responseHeaders: givenHeaders },
                givenType,
                givenKey,
                [statusCode, {}, givenHeaders]
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
                });
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

        try {
            await createCmdb().getItemFields(stubLocals, givenType, givenKey);
        } finally {
            expect(stubHttp.isDone()).toBeTruthy();
        }
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

        try {
            await createCmdb().putItem(
                stubLocals,
                givenType,
                givenKey,
                dummyBody
            );
        } finally {
            expect(stubHttp.isDone()).toBeTruthy();
        }
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

        try {
            await createCmdb().deleteItem(stubLocals, givenType, givenKey);
        } finally {
            expect(stubHttp.isDone()).toBeTruthy();
        }
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

    test('should require type', async () => {
        expect.assertions(1);

        await expect(() =>
            createCmdb().getAllItems(stubLocals, undefined)
        ).toThrow("The config parameter 'type' is required");
    });

    test('should call the correct endpoint', async () => {
        expect.assertions(1);
        const stubHttp = stubGetAllItems(stubType);

        try {
            await createCmdb().getAllItems(stubLocals, stubType);
        } finally {
            expect(stubHttp.isDone()).toBeTruthy();
        }
    });

    test('should return the cmdb response', async () => {
        expect.assertions(1);
        stubGetAllItems(stubType);

        await expect(
            createCmdb().getAllItems(stubLocals, stubType)
        ).resolves.toMatchSnapshot();
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

        try {
            await createCmdb().getAllItemFields(stubLocals, stubType);
        } finally {
            expect(stubHttp.isDone()).toBeTruthy();
        }
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

        try {
            await createCmdb().getItemCount(stubLocals, stubType);
        } finally {
            expect(stubHttp.isDone()).toBeTruthy();
        }
    });

    test('should return the cmdb response', async () => {
        expect.assertions(1);
        stubGetItemCount(stubType);

        await expect(
            createCmdb().getItemCount(stubLocals, stubType)
        ).resolves.toEqual({
            pages: 1,
            items: 2,
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

        try {
            await createCmdb().getItemPage(stubLocals, stubType);
        } finally {
            expect(stubHttp.isDone()).toBeTruthy();
        }
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

        try {
            await createCmdb().getItemPageFields(stubLocals, stubType);
        } finally {
            expect(stubHttp.isDone()).toBeTruthy();
        }
    });

    test('should return the cmdb response', async () => {
        expect.assertions(1);
        stubGetItemPageFields(stubType);

        await expect(
            createCmdb().getItemPageFields(stubLocals, stubType)
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
            const stubHttp = stubRelationshipsResponse(
                { verb },
                dummySubjectType,
                dummySubjectID,
                dummyRelType,
                dummyObjectType,
                dummyObjectID
            );

            try {
                await createCmdb()[method](
                    stubLocals,
                    dummySubjectType,
                    dummySubjectID,
                    dummyRelType,
                    dummyObjectType,
                    dummyObjectID
                );
            } finally {
                expect(stubHttp.isDone()).toBeTruthy();
            }
        });
        test('should return the cmdb response', async () => {
            expect.assertions(1);
            stubRelationshipsResponse(
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
