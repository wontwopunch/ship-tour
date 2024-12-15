const { MongoClient } = require('mongodb');

async function clearDatabase() {
    const uri = "mongodb://localhost:27017/"; // MongoDB 연결 URI
    const dbName = "ship-tour"; // 초기화할 데이터베이스 이름
    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db(dbName);

        // 데이터베이스의 모든 컬렉션을 가져옴
        const collections = await db.listCollections().toArray();

        for (const collection of collections) {
            // 각 컬렉션의 데이터를 삭제
            await db.collection(collection.name).deleteMany({});
            console.log(`컬렉션 ${collection.name} 초기화 완료`);
        }

        console.log(`데이터베이스 ${dbName}의 모든 데이터가 삭제되었습니다.`);
    } catch (error) {
        console.error("데이터 초기화 중 오류 발생:", error);
    } finally {
        await client.close();
    }
}

clearDatabase();
