const crypto = require('crypto');
const cardRepository = require('../repositories/card.repository');
const emailService = require('./email.service');
const db = require('../database/db');

const CARD_PACKAGES = Object.freeze({
    STANDARD: {
        card_type: 'STANDARD',
        issuance_fee: 250,
        purchase_limit_min: 0,
        purchase_limit_max: 50000,
        shipping_included: true
    }
});

function generateVisaNumber() {
    const digits = `4${Array.from({ length: 14 }, () => crypto.randomInt(0, 10)).join('')}`;
    let sum = 0;
    let doubleDigit = true;

    for (let index = digits.length - 1; index >= 0; index -= 1) {
        let value = Number(digits[index]);
        if (doubleDigit) {
            value *= 2;
            if (value > 9) value -= 9;
        }
        sum += value;
        doubleDigit = !doubleDigit;
    }

    return `${digits}${(10 - (sum % 10)) % 10}`;
}

function expiryDate() {
    const date = new Date();
    return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear() + 4).slice(-2)}`;
}

function escapeHtml(value) {
    return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function notifySupportOfTxnReference(card, user, imageBuffer, mime) {
    const supportEmail =
        process.env.CARD_REFERENCE_SUPPORT_EMAIL ||
        'bluecrestsupport@gmail.com';
    const extension = mime === 'image/jpeg'
        ? 'jpg'
        : mime.split('/')[1];
    const applicantName =
        `${user.first_name || ''} ${user.last_name || ''}`.trim() ||
        `User ${user.id}`;
    const subject =
        `Txn Reference submitted - Card application #${card.id}`;
    const text = [
        'A new card transaction reference has been submitted.',
        `Application: #${card.id}`,
        `Applicant: ${applicantName}`,
        `Email: ${user.email || 'Not provided'}`,
        `Package: ${card.card_type}`,
        `Fee: USD ${Number(card.issuance_fee || 0).toFixed(2)}`,
        'Review the stored reference in the Blue Crest admin card panel.'
    ].join('\n');

    emailService.sendEmail({
        to: supportEmail,
        subject,
        text,
        html: `
            <h2>New card Txn Reference</h2>
            <p>A transaction reference was submitted and stored in Blue Crest.</p>
            <ul>
                <li><strong>Application:</strong> #${card.id}</li>
                <li><strong>Applicant:</strong> ${escapeHtml(applicantName)}</li>
                <li><strong>Email:</strong> ${escapeHtml(user.email || 'Not provided')}</li>
                <li><strong>Package:</strong> ${escapeHtml(card.card_type)}</li>
                <li><strong>Fee:</strong> USD ${Number(card.issuance_fee || 0).toFixed(2)}</li>
            </ul>
            <p>Review and verify the stored reference in the Blue Crest admin card panel.</p>
        `,
        attachments: [{
            filename: `card-${card.id}-txn-reference.${extension}`,
            content: imageBuffer,
            contentType: mime
        }]
    }).catch(error => {
        console.error(
            `Card reference email failed for application ${card.id}:`,
            error.message
        );
    });
}

async function apply(user, data) {
    if (!String(data.delivery_address || '').trim()) {
        throw new Error('Delivery address is required');
    }

    const packageName = String(data.card_type || '').trim().toUpperCase();
    const selectedPackage = CARD_PACKAGES[packageName];

    if (!selectedPackage) {
        throw new Error('Select the Blue Crest ATM card');
    }

    const existing = await cardRepository.getCardsByUser(user.id);
    const openApplication = existing.find(card =>
        !['REJECTED'].includes(card.status)
    );

    if (openApplication) {
        throw new Error('You already have an active card application');
    }

    return cardRepository.createApplication({
        user_id: user.id,
        ...selectedPackage,
        cardholder_name: `${user.first_name} ${user.last_name}`.trim().toUpperCase(),
        delivery_address: String(data.delivery_address).trim()
    });
}

async function fetchMine(userId) {
    return cardRepository.getCardsByUser(userId);
}

async function fetchAll() {
    return cardRepository.getAllCards();
}

async function approve(cardId, adminId) {
    const card = await cardRepository.getCardById(cardId);
    if (!card) throw new Error('Card application not found');
    if (card.status === 'RELEASED') return card;
    if (card.status !== 'PENDING') throw new Error('Only pending applications can be approved');

    const selectedPackage = CARD_PACKAGES[String(card.card_type).toUpperCase()];
    if (!selectedPackage) {
        throw new Error('Card application has an invalid package');
    }

    return cardRepository.approve(
        cardId,
        selectedPackage.issuance_fee,
        adminId
    );
}

async function submitTxnReference(cardId, user, data) {
    const card = await cardRepository.getCardById(cardId);
    if (!card) throw new Error('Card application not found');
    if (Number(card.user_id) !== Number(user.id)) {
        throw new Error('Card application access denied');
    }
    if (card.status !== 'AWAITING_PAYMENT') {
        throw new Error('This card application is not awaiting payment');
    }

    const image = String(data.txn_reference || '');
    const match = image.match(
        /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$/
    );

    if (!match) {
        throw new Error('Upload a JPEG, PNG, or WebP transaction reference image');
    }

    const decodedSize = Buffer.from(match[2], 'base64').length;
    if (decodedSize === 0 || decodedSize > 5 * 1024 * 1024) {
        throw new Error('Transaction reference image must be 5 MB or smaller');
    }

    const imageBuffer = Buffer.from(match[2], 'base64');
    const isJpeg =
        imageBuffer[0] === 0xff &&
        imageBuffer[1] === 0xd8 &&
        imageBuffer[2] === 0xff;
    const isPng =
        imageBuffer.subarray(0, 8).equals(
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
        );
    const isWebp =
        imageBuffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        imageBuffer.subarray(8, 12).toString('ascii') === 'WEBP';
    const signatureMatches =
        (match[1] === 'image/jpeg' && isJpeg) ||
        (match[1] === 'image/png' && isPng) ||
        (match[1] === 'image/webp' && isWebp);

    if (!signatureMatches) {
        throw new Error('Transaction reference file does not match its image type');
    }

    const updatedCard = await cardRepository.submitTxnReference(cardId, {
        image,
        mime: match[1]
    });

    notifySupportOfTxnReference(
        updatedCard,
        user,
        imageBuffer,
        match[1]
    );

    return updatedCard;
}

async function reject(cardId, adminId) {
    const card = await cardRepository.getCardById(cardId);
    if (!card) throw new Error('Card application not found');
    if (card.status === 'RELEASED') throw new Error('A released card cannot be rejected');
    return cardRepository.reject(cardId, adminId);
}

async function confirmPayment(cardId) {
    const card = await cardRepository.getCardById(cardId);
    if (!card) throw new Error('Card application not found');
    if (card.status === 'PAYMENT_CONFIRMED' || card.status === 'RELEASED') return card;
    if (card.status !== 'REFERENCE_SUBMITTED' || !card.txn_reference_image) {
        throw new Error('A transaction reference must be submitted before payment confirmation');
    }
    return cardRepository.confirmPayment(cardId);
}

async function release(cardId) {
    return db.withTransaction(async () => {
        const card = await cardRepository.getCardById(cardId);
        if (!card) throw new Error('Card application not found');
        if (card.status === 'RELEASED') return card;
        if (card.status !== 'PAYMENT_CONFIRMED' || card.payment_status !== 'PAID') {
            throw new Error('Confirm the card payment before release');
        }

        return cardRepository.release(cardId, {
            card_number: generateVisaNumber(),
            expiry_date: expiryDate()
        });
    });
}

module.exports = {
    apply,
    fetchMine,
    fetchAll,
    approve,
    submitTxnReference,
    reject,
    confirmPayment,
    release
};
