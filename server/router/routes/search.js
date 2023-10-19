const express = require("express");

const search = express.Router(); // CHANGE 'search' TO THE NAME OF YOUR ROUTE
const utils = require("../../../utils");

// SQL DATABASE ROUTES

search.route("/audio").post(async (req, res) => {
  // validate request body
  const bodyVerify = utils.validateRequestBody(req.body, [
    { prop: "searchText", type: "string" },
  ]);
  if (bodyVerify.length > 0) {
    let status = 400;
    res.status(status).send(utils.response(status, false, null, bodyVerify));
    return;
  }

  let status;
  searchText = req.body.searchText
  const limit = req.body.limit ? `LIMIT ${req.body.limit}` : "";
  const offset = req.body.offset ? req.body.offset : 0;
  queryString = "";
  queryParams = []
  const category = req.body.category
  const hasSpaces = searchText.includes(' ');
  if (category) {
    if (hasSpaces) {
      const tsquery = searchText.split(' ').map(word => `${word}:*`).join(' & ')
    queryString = `
      SELECT audio.*, array_agg(categories.title) AS categories
      FROM audio
      LEFT JOIN audiocategories ON audio.id = audiocategories.audio_id
      LEFT JOIN categories ON audiocategories.category_id = categories.id
      WHERE (audio.title ILIKE '%' || $1 || '%' OR audio.author ILIKE '%' || $1 || '%' OR audio.tags ILIKE '%' || $1 || '%')
        AND to_tsvector('english', audio.title || ' ' || audio.author || ' ' || audio.tags) @@ to_tsquery('english', $2)
        AND categories.id = $3
      GROUP BY audio.id
      ORDER BY ts_rank(to_tsvector('english', audio.title || ' ' || audio.author || ' ' || audio.tags), to_tsquery('english', $2)) DESC
      ${limit} OFFSET $4
    `;
    queryParams = [searchText, tsquery, category.id, offset];
    } else {
      queryString = `
        SELECT audio.*, array_agg(categories.title) AS categories
        FROM audio
        LEFT JOIN audiocategories ON audio.id = audiocategories.audio_id
        LEFT JOIN categories ON audiocategories.category_id = categories.id
        WHERE (audio.title ILIKE '%' || $1 || '%' OR audio.author ILIKE '%' || $1 || '%' OR audio.tags ILIKE '%' || $1 || '%')
          AND categories.id = $2
        GROUP BY audio.id
        ORDER BY ts_rank(to_tsvector('english', audio.title || ' ' || audio.author || ' ' || audio.tags), to_tsquery('english', $1)) DESC
        ${limit} OFFSET $3
      `;
      queryParams = [searchText, category.id, offset];
    }
  } else {
    // Construct the tsquery based on whether there are spaces
    if (hasSpaces) {
      const tsquery = searchText.split(' ').map(word => `${word}:*`).join(' & ')
      queryString = `
        SELECT audio.*, array_agg(categories.title) AS categories
        FROM audio
        LEFT JOIN audiocategories ON audio.id = audiocategories.audio_id
        LEFT JOIN categories ON audiocategories.category_id = categories.id
        WHERE (audio.title ILIKE '%' || $1 || '%' OR audio.author ILIKE '%' || $1 || '%' OR audio.tags ILIKE '%' || $1 || '%')
        AND to_tsvector('english', audio.title || ' ' || audio.author || ' ' || audio.tags) @@ to_tsquery('english', $2)
        GROUP BY audio.id
        ORDER BY ts_rank(to_tsvector('english', audio.title || ' ' || audio.author || ' ' || audio.tags), to_tsquery('english', $2)) DESC
        ${limit} OFFSET $3
      `;
      queryParams = [searchText, tsquery, offset];
    } else {
          queryString = `
      SELECT audio.*, array_agg(categories.title) AS categories
      FROM audio
      LEFT JOIN audiocategories ON audio.id = audiocategories.audio_id
      LEFT JOIN categories ON audiocategories.category_id = categories.id
      WHERE audio.title ILIKE '%' || $1 || '%' OR audio.author ILIKE '%' || $1 || '%' OR audio.tags ILIKE '%' || $1 || '%'
      GROUP BY audio.id
      ORDER BY ts_rank(to_tsvector('english', audio.title || ' ' || audio.author || ' ' || audio.tags), to_tsquery('english', $1)) DESC
      ${limit} OFFSET $2
    `;
    queryParams = [searchText, offset];
    }
  }

  await utils
    .queryPG(queryString, queryParams, req.baseUrl)
    .then((result) => {
      status = 200
      res.status(status).send(result);
    })
    .catch((error) => {
      status = 500;
      console.log(`Error in ${req.baseUrl}: `, error);
      res.status(status).send(result);
    });
});

module.exports = search; // CHANGE 'search' TO YOUR ROUTE
