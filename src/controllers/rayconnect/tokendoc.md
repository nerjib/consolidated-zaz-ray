An API for generating and viewing activation codes for BioLite products.

The API provides the ability to generate new codes for products under the control of the API consumer, get and view previously created codes with a range of filtering and sorting options, and create batch code generation operations that are run asynchronously on the BioLite server and which can be queried for progress as needed. The API is secured using a public-private key pair, which is used to authenticate the API consumer and generate access tokens for the core API.

Authentication procedure:

Prepare a signed JWT auth token including a provided client key, signed with a private authentication key.
Use this auth token to obtain a temporary access token to enable access to API resources.
Provide this access token in the Authorization header of all future API requests.
Code creation and viewing procedure:

Generate individual codes via POSTs to the /codes end-point, including product serial number, code type and code argument (if applicable).
View previously generated codes via GETs to the /codes end-point, using filtering, sorting and paging parameters as required.
Batch operations:

Create a batch code generation operation via a POST to the /batch end-point.
Monitor the status of all batch operations via GETs to the /batch end-point.
Access the status and results of a specific batch operation using the /batch/{id} end-point.
Code types and arguments:

add_time: code represents a specific activation time that will be added to the existing product activation time when the code is entered. Argument: integer 0-999 inclusive, representing days of activation time to add.
set_time: code represents a specific activation time that the existing product activation time will be set to when the code is entered. Previously generated add_time and set_time code will be invalidated on successful entry of a set_time code. Argument: integer 0-999 inclusive, representing days of activation time to set.
1_hour: code represents addition of one hour to current product activation time. Argument ignored.
1_minute: code represents addition of one minute to current product activation time. Argument ignored.
credit_reset: when entered, product credit will be set to zero, but previously generated codes will still be considered valid. Generally only required for maintenance or other non-standard use case. Argument ignored.
history_reset: when entered, history of previously received codes will be erased from product. Generally only required for maintenance or other non-standard use case. Argument ignored.
full_reset: when entered, history of previously received codes will be erased from product, and product credit will be set to zero. Generally only required for maintenance or other non-standard use case. Argument ignored.
unlock: when entered, product will be permanently activated, activation will never expire, and no further activation codes will be required. Argument ignored


(body)
A valid, signed JWT auth token.

Auth tokens must contain a valid API client key in the ‘iss’ claim. The ‘iat’ claim must contain a UTC timestamp, which will be verified on the server. The ‘jti’ claim must contain a unique single-use string. The ‘sub’ claim must contain a public key compatible with ECDSA signing on the P-256 curve, and this key must be registered with BioLite. The auth token must be signed using the matching private key. Note that this private key is known only to the client and is not communicated to or stored by BioLite.
curl -X POST "https://rfpr18f801.execute-api.eu-west-1.amazonaws.com/v1_dev/auth" -H  "accept: application/json" -H  "content-type: application/json" -d "{  \"token\": \"string\",  \"tokenType\": \"auth\"}"




(body)
A code request specification including product serial number, type and argument, or serial number and data payload (deprecated). If code type and argument are present, they will override any explicit data payload provided.
curl -X POST "https://rfpr18f801.execute-api.eu-west-1.amazonaws.com/v1_dev/codes" -H  "accept: application/json" -H  "Authorization: y" -H  "content-type: application/json" -d "{  \"arg\": 0,  \"data\": 0,  \"serialNum\": 0,  \"codeType\": \"string\"}"
