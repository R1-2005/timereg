import { MONTH_NAMES } from '../utils/formatting.js';

export default {
    name: 'MonthPicker',
    template: `
        <div class="month-picker">
            <button class="month-btn" @click="prev">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M12 15L7 10L12 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <span class="month-display">{{ monthName }} {{ year }}</span>
            <button class="month-btn" @click="next">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M8 5L13 10L8 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
        </div>
    `,
    props: {
        year: { type: Number, required: true },
        month: { type: Number, required: true }
    },
    emits: ['update:year', 'update:month'],
    computed: {
        monthName() {
            return MONTH_NAMES[this.month - 1];
        }
    },
    methods: {
        prev() {
            let y = this.year;
            let m = this.month - 1;
            if (m < 1) {
                m = 12;
                y--;
            }
            this.$emit('update:year', y);
            this.$emit('update:month', m);
        },
        next() {
            let y = this.year;
            let m = this.month + 1;
            if (m > 12) {
                m = 1;
                y++;
            }
            this.$emit('update:year', y);
            this.$emit('update:month', m);
        }
    }
};
