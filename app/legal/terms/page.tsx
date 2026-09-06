import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_NAME } from '@/lib/site';
import styles from '../legal.module.css';

export const metadata: Metadata = { title: '이용약관' };

/** 초안. app/legal/privacy/page.tsx 의 주석 참고. */
export default function TermsPage() {
  return (
    <div className="page">
      <article className={styles.wrap}>
        <p className="kicker">TERMS</p>
        <h1 className={styles.title}>이용약관</h1>
        <p className={styles.updated}>시행일 TODO</p>

        <p className={styles.draft}>
          <strong>초안입니다.</strong> <span className={styles.todo}>TODO</span> 로 표시된
          항목을 채우고 이 안내를 지운 뒤 공개하세요. 서비스 성격상 특히 중요한 것은
          8조(게시물의 관리)와 9조(권리 귀속)입니다 — 남의 글을 받는 매체이므로 이 둘이
          비어 있으면 분쟁이 났을 때 기댈 곳이 없습니다.
        </p>

        <div className={styles.body}>
          <h2>제1조 (목적)</h2>
          <p>
            이 약관은 {SITE_NAME}(이하 &ldquo;서비스&rdquo;)의 이용 조건과 절차, 이용자와
            운영자의 권리·의무를 정합니다.
          </p>

          <h2>제2조 (운영자)</h2>
          <p>
            <span className={styles.todo}>TODO</span> — 개인이라면 이름과 연락처,
            사업자라면 상호·대표자·사업자등록번호·주소·연락처.
          </p>

          <h2>제3조 (약관의 효력과 변경)</h2>
          <p>
            이 약관은 서비스 화면에 게시함으로써 효력이 발생합니다. 운영자는 약관을
            변경할 수 있으며, 변경 시 시행일과 변경 내용을 사전에 공지합니다. 이용자에게
            불리한 변경은 <span className={styles.todo}>TODO</span>일 전에 공지합니다.
          </p>

          <h2>제4조 (회원 가입)</h2>
          <p>
            이메일 주소로 가입합니다. 비밀번호는 사용하지 않으며, 로그인은 이메일로 보내는
            일회용 링크로 이루어집니다. 이메일 계정의 관리 책임은 이용자에게 있습니다.
          </p>

          <h2>제5조 (계정과 핸들)</h2>
          <p>
            핸들은 영소문자·숫자·밑줄 3~20자이며 다른 이용자와 중복될 수 없습니다.
            운영자를 사칭하거나 오인하게 하는 핸들은 사용할 수 없고, 이미 사용 중이라면
            변경을 요청하거나 회수할 수 있습니다.
          </p>

          <h2>제6조 (탈퇴)</h2>
          <p>
            이용자는 언제든 탈퇴할 수 있습니다.{' '}
            <span className={styles.todo}>TODO</span> — 탈퇴 시 작성한 글과 댓글을 어떻게
            할지(함께 삭제 / 필자 표시만 제거하고 존치)를 정해 명시하세요. 이 선택은
            <Link href="/legal/privacy"> 개인정보처리방침</Link>의 보유 기간과 반드시
            일치해야 합니다.
          </p>

          <h2>제7조 (금지 행위)</h2>
          <ul>
            <li>타인의 저작권·초상권·명예 등 권리를 침해하는 게시물 등록</li>
            <li>타인을 사칭하거나 허위 사실을 게시하는 행위</li>
            <li>서비스의 정상적인 운영을 방해하는 행위</li>
            <li>자동화된 수단으로 서비스에 반복 접근하는 행위</li>
            <li>
              <span className={styles.todo}>TODO</span> — 매체 성격에 맞는 항목 추가
            </li>
          </ul>

          <h2>제8조 (게시물의 관리)</h2>
          <p>
            운영자는 제7조를 위반하거나 법령에 어긋나는 게시물을 이용자에게 사전 통지 없이
            비공개 처리할 수 있습니다. 비공개는 삭제가 아니며 되돌릴 수 있습니다. 비공개
            처리한 경우 그 사실과 사유를 작성자에게 알립니다.
          </p>
          <p>
            <span className={styles.todo}>TODO</span> — 이의 제기 절차와 처리 기한을
            정하세요. 이게 없으면 조치가 자의적으로 보입니다.
          </p>

          <h2>제9조 (게시물의 권리)</h2>
          <p>
            이용자가 작성한 게시물의 저작권은 <strong>작성자에게 있습니다.</strong>
          </p>
          <p>
            이용자는 운영자에게 해당 게시물을 서비스 내에 게시·복제·전송하고, 서비스 홍보를
            위해 일부를 인용할 수 있는 권리를 부여합니다. 이 권리는{' '}
            <span className={styles.todo}>TODO</span> — 범위를 좁게 정하는 편이 필자를
            모으는 데 유리합니다. &ldquo;모든 매체에 무상·영구·독점&rdquo; 같은 문구는
            글 받는 매체에서 필자가 가장 경계하는 조항입니다.
          </p>

          <h2>제10조 (서비스의 중단)</h2>
          <p>
            운영자는 서비스를 변경하거나 중단할 수 있습니다. 서비스를 종료할 때는 사전에
            공지하고, 이용자가 자신의 게시물을 내려받을 수 있는 기간을 둡니다.
          </p>

          <h2>제11조 (책임의 한계)</h2>
          <p>
            게시물의 내용에 대한 책임은 작성자에게 있습니다. 운영자는 무상으로 제공되는
            서비스의 이용과 관련해 관련 법령에 특별한 규정이 없는 한 책임을 지지 않습니다.
          </p>

          <h2>제12조 (분쟁의 해결)</h2>
          <p>
            <span className={styles.todo}>TODO</span> — 준거법과 관할 법원.
          </p>
        </div>
      </article>
    </div>
  );
}
