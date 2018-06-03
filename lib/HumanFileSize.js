module.exports = class HumanFileSize {
  constructor(value, unit) {
    this.value = value;
    this.unit = unit;
  }

  toString() {
    return `${this.value} ${this.unit}`;
  }

  static humanize(bytes, unit) {
    if (unit == 'MB') {
      return new HumanFileSize(Math.round(bytes / (1024 * 1024) * 100 + Number.EPSILON) / 100, unit);
    } else if (unit == 'KB') {
      return new HumanFileSize(Math.round(bytes / 1024 * 100 + Number.EPSILON) / 100, unit);
    }
    return new HumanFileSize(Math.round(bytes * 100 + Number.EPSILON) / 100, unit);
  }

  static auto(bytes) {
    if (bytes >= 1048576) {
      return HumanFileSize.humanize(bytes, 'MB');
    } else if (bytes >= 1024) {
      return HumanFileSize.humanize(bytes, 'MB');
    }
    return HumanFileSize.humanize(bytes, 'B');
  }

}
