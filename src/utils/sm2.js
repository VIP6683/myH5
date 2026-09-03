import { sm2 } from 'sm-crypto';

const SYS_PUBLIC_KEY =
	'0413049fb1c7b658a17c6ea59993edef1d601b262fb8f4011916dbcf984963f44dd170c18bc3dc66be29815971bd729dace912030c255cfcbbe0015134d2930145';

const CIPHER_MODE = 0;

export function encryptBySm2(data) {
	if (typeof data !== 'string' || !data) {
		return '';
	}

	return `04${sm2.doEncrypt(data, SYS_PUBLIC_KEY, CIPHER_MODE)}`;
}
