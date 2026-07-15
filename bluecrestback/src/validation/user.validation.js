function validateRegisterInput(body) {

    const errors = [];

    if (
        !body.first_name ||
        body.first_name.trim() === ''
    ) {
        errors.push(
            'First name is required'
        );
    }

    if (
        !body.last_name ||
        body.last_name.trim() === ''
    ) {
        errors.push(
            'Last name is required'
        );
    }

    if (
        !body.username ||
        body.username.trim() === ''
    ) {
        errors.push(
            'Username is required'
        );
    }

    if (
        !body.email ||
        body.email.trim() === ''
    ) {
        errors.push(
            'Email is required'
        );
    }

    if (
        body.email &&
        !body.email.includes('@')
    ) {
        errors.push(
            'Invalid email format'
        );
    }

    if (
        !body.phone ||
        body.phone.trim() === ''
    ) {
        errors.push(
            'Phone number is required'
        );
    }

    if (
        !body.password ||
        body.password.length < 6
    ) {
        errors.push(
            'Password must be at least 6 characters'
        );
    }

    const accountType = String(body.account_type || '').trim().toUpperCase();
    if (!['CHECKING', 'SAVINGS', 'FIXED_DEPOSIT'].includes(accountType)) {
        errors.push('Account type is required');
    }

    if (!/^\d{4}$/.test(String(body.login_code || ''))) {
        errors.push('Login code must be exactly 4 digits');
    }

    if (String(body.login_code || '') !== String(body.login_code_confirmation || '')) {
        errors.push('Login code confirmation does not match');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

module.exports = {
    validateRegisterInput
};
