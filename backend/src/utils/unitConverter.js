// Unit conversion utility for fabric measurements

const CONVERSIONS = {
  // To meters
  meter: 1,
  m: 1,
  yard: 0.9144,
  yd: 0.9144,
  feet: 0.3048,
  ft: 0.3048,
  inch: 0.0254,
  in: 0.0254,
  centimeter: 0.01,
  cm: 0.01,
};

class UnitConverter {
  /**
   * Convert any unit to meters
   * @param {number} value - The value to convert
   * @param {string} fromUnit - Source unit (meter, yard, feet, inch, cm)
   * @returns {number} Value in meters
   */
  static toMeters(value, fromUnit = 'meter') {
    const unit = fromUnit.toLowerCase();
    const conversionFactor = CONVERSIONS[unit];
    
    if (!conversionFactor) {
      throw new Error(`Unknown unit: ${fromUnit}. Supported: meter, yard, feet, inch, centimeter`);
    }
    
    return parseFloat((value * conversionFactor).toFixed(4));
  }

  /**
   * Convert meters to any unit
   * @param {number} meters - Value in meters
   * @param {string} toUnit - Target unit
   * @returns {number} Converted value
   */
  static fromMeters(meters, toUnit = 'meter') {
    const unit = toUnit.toLowerCase();
    const conversionFactor = CONVERSIONS[unit];
    
    if (!conversionFactor) {
      throw new Error(`Unknown unit: ${toUnit}`);
    }
    
    return parseFloat((meters / conversionFactor).toFixed(4));
  }

  /**
   * Convert between any two units
   * @param {number} value - Value to convert
   * @param {string} fromUnit - Source unit
   * @param {string} toUnit - Target unit
   * @returns {number} Converted value
   */
  static convert(value, fromUnit, toUnit) {
    const meters = this.toMeters(value, fromUnit);
    return this.fromMeters(meters, toUnit);
  }

  /**
   * Get value in all supported units
   * @param {number} meters - Value in meters
   * @returns {object} Object with all unit conversions
   */
  static getAllUnits(meters) {
    return {
      meters: parseFloat(meters.toFixed(4)),
      yards: parseFloat(this.fromMeters(meters, 'yard').toFixed(4)),
      feet: parseFloat(this.fromMeters(meters, 'feet').toFixed(4)),
      inches: parseFloat(this.fromMeters(meters, 'inch').toFixed(2)),
      centimeters: parseFloat(this.fromMeters(meters, 'cm').toFixed(2)),
    };
  }

  /**
   * Format display with unit
   * @param {number} value - Numeric value
   * @param {string} unit - Unit name
   * @returns {string} Formatted string
   */
  static formatDisplay(value, unit = 'meter') {
    const unitLabels = {
      meter: 'm',
      m: 'm',
      yard: 'yd',
      yd: 'yd',
      feet: 'ft',
      ft: 'ft',
      inch: 'in',
      in: 'in',
      centimeter: 'cm',
      cm: 'cm',
    };
    
    const label = unitLabels[unit.toLowerCase()] || unit;
    return `${value.toFixed(2)} ${label}`;
  }

  /**
   * Validate unit name
   * @param {string} unit - Unit to validate
   * @returns {boolean}
   */
  static isValidUnit(unit) {
    return CONVERSIONS.hasOwnProperty(unit.toLowerCase());
  }

  /**
   * Get all supported units
   * @returns {array} List of supported units
   */
  static getSupportedUnits() {
    return ['meter', 'yard', 'feet', 'inch', 'centimeter'];
  }
}

module.exports = UnitConverter;