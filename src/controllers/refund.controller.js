const db = require("../../models");
const Refund = db.refunds;
const Payment = db.payments;
const readXlsxFile = require("read-excel-file/node");

exports.createRefund = async (req, res) => {
    const { ippis, amount, reason, name, element, command } = req.body;
    const period = String(req.body.period); // Ensure period is a string

    if (!ippis || !period || !amount) {
        return res.status(400).send({ message: "ippis, period, and amount are required" });
    }

    try {
        const payment = await Payment.findOne({ where: { ippis, period } });

        // if (!payment) {
        //     return res.status(404).send({ message: "Payment not found" });
        // }

        // if (payment.amount < amount) {
        //     return res.status(400).send({ message: "Refund amount cannot be greater than payment amount" });
        // }

        const refund = await Refund.create({
            payment_ippis: ippis,
            payment_period: period,
            amount,
            reason,
            name: name || payment.name,
            element: element || payment.element,
            command: command || payment.command
        });

        let newStatus = 'partially-refunded';
        if (payment?.amount === amount) {
            newStatus = 'refunded';
        }

        await payment.update({ status: newStatus });

        res.status(201).send(refund);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};

exports.bulkRefund = async (req, res) => {
    try {
        if (req.file == undefined) {
            return res.status(400).send("Please upload an excel file!");
        }

        let path = `${req.file.destination}/${req.file.originalname}`;
        readXlsxFile(path).then(async (rows) => {
            rows.shift(); // skip header

            const refunds = [];
            for (const row of rows) {
                console.log({row})
                const ippis = row[0];
                const period = String(row[5]);
                const amount = row[4];
                const reason = row[3];
                const name = row[2];
                const element = row[3];
                const command = row[6];

                if (!ippis || !period || !amount) {
                    console.error('Skipping row due to missing data:', row);
                    continue; 
                }

                const payment = await Payment.findOne({ where: { ippis, period } });

                // if (!payment) {
                //     console.error(`Payment not found for ippis: ${ippis} and period: ${period}. Skipping.`);
                //     continue;
                // }
                
                // if (payment.amount < amount) {
                //     console.error(`Refund amount for ippis: ${ippis} and period: ${period} is greater than payment amount. Skipping.`);
                //     continue;
                // }

                refunds.push({
                    payment_ippis: ippis,
                    payment_period: period,
                    amount,
                    reason,
                    name: name || payment?.name,
                    element: element || payment?.element,
                    command: command || payment?.command
                });

                let newStatus = 'partially-refunded';
                if (payment?.amount === amount) {
                    newStatus = 'refunded';
                }
        
                await payment?.update({ status: newStatus });
            }

            const createdRefunds = await Refund.bulkCreate(refunds, { ignoreDuplicates: true });
            res.status(200).send({ 
                status: true,
                message: `Processed ${createdRefunds.length} refunds successfully.`
            });

        })
        .catch((error) => {
            console.log(error);
            let errorMessage = "Error processing the uploaded file.";
            if (req.file && req.file.originalname) {
                errorMessage = "Could not process the file: " + req.file.originalname;
            }
            if (error.message && error.message.includes('invalid signature')) {
                errorMessage = "The uploaded file is not a valid Excel file or is corrupted. Please upload a valid .xlsx file.";
            }
            res.status(500).send({
                status: false,
                message: errorMessage,
            });
        });
    } catch (error) {
        console.log(error);
        let errorMessage = "Could not upload the file: " + req.file.originalname;
        if (error.message && error.message.includes('invalid signature')) {
            errorMessage = "The uploaded file is not a valid Excel file or is corrupted. Please upload a valid .xlsx file.";
        }
        res.status(500).send({
            status: false,
            message: errorMessage,
        });
    }
};

exports.getAllRefunds = async (req, res) => {
    try {
        const refunds = await Refund.findAll();
        res.status(200).send({data:refunds, status:true });
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};

exports.getRefundsByUser = async (req, res) => {
    const { ippis } = req.params;
    try {
        const refunds = await Refund.findAll({ where: { payment_ippis: ippis } });
        res.status(200).send(refunds);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};
