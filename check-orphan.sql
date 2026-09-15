SELECT
  id,
  "orderNumber",
  "images",
  "imagesUrl",
  "patientId",
  "createdAt"
FROM "ImagingOrder"
WHERE "images" LIKE '%img-1787564733481-483300129%'
   OR "imagesUrl" LIKE '%img-1787564733481-483300129%';