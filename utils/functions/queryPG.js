const dbConnect = require("../../server/database");
const pool = dbConnect();

async function queryPG(queryString, queryParams, route) {
  try {
    let result = await pool.query(queryString, queryParams);
    return { data: result.rows, success: true, message: "" };
  } catch (err) {
    console.log(err)
    return {
      data: null,
      success: false,
      message: `Error executing query from ${route} QUERY = ${queryString}: ${err}`,
    };
  } 
}

module.exports = queryPG;
