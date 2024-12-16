const { MongoClient } = require('mongodb');

async function clearDatabase() {
    const uri = "mongodb://localhost:27017/"; // MongoDB URI
    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db("ship-tour"); // 데이터베이스 이름
        const collections = await db.listCollections().toArray();

        for (const collection of collections) {
            await db.collection(collection.name).deleteMany({});
        }

        console.log("모든 컬렉션의 데이터가 삭제되었습니다.");
    } catch (error) {
        console.error("데이터 삭제 중 오류:", error);
    } finally {
        await client.close();
    }
}

clearDatabase();
