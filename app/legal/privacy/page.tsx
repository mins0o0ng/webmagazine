import type { Metadata } from 'next';
import { SITE_NAME } from '@/lib/site';
import styles from '../legal.module.css';

export const metadata: Metadata = { title: '개인정보처리방침' };

/**
 * 초안이다.
 *
 * "수집 항목"과 "처리 위탁"은 실제 코드에서 확인한 사실이라 정확하다.
 * 운영자 신원·연락처·보유 기간은 결정 사항이라 비워두었다 — TODO 로 표시된 곳.
 * 서비스 개시 전에 채우고 초안 안내를 지울 것.
 */
export default function PrivacyPage() {
  return (
    <div className="page">
      <article className={styles.wrap}>
        <p className="kicker">PRIVACY</p>
        <h1 className={styles.title}>개인정보처리방침</h1>
        <p className={styles.updated}>최종 수정일 TODO</p>

        <p className={styles.draft}>
          <strong>초안입니다.</strong> 가입 기능을 여는 시점부터 이 문서는 법적 의무가
          됩니다. 아래 <span className={styles.todo}>TODO</span> 로 표시된 항목을 채우고
          이 안내를 지운 뒤 공개하세요. 수집 항목과 처리 위탁 부분은 실제 코드에서
          확인한 내용이라 그대로 쓸 수 있습니다.
        </p>

        <div className={styles.body}>
          <h2>1. 처리하는 개인정보</h2>
          <table>
            <thead>
              <tr>
                <th>항목</th>
                <th>수집 시점</th>
                <th>근거</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>이메일 주소</td>
                <td>가입·로그인</td>
                <td>계정 식별과 로그인 링크 발송. 서비스 제공에 필수</td>
              </tr>
              <tr>
                <td>핸들, 표시 이름</td>
                <td>가입</td>
                <td>글과 댓글에 필자를 표시하기 위함</td>
              </tr>
              <tr>
                <td>소개글, 프로필 사진</td>
                <td>이용자가 직접 입력</td>
                <td>선택 항목</td>
              </tr>
              <tr>
                <td>작성한 글·댓글·좋아요</td>
                <td>이용 중</td>
                <td>서비스의 본질적 기능</td>
              </tr>
              <tr>
                <td>접속 기록, IP 주소, 브라우저 정보</td>
                <td>접속 시 자동</td>
                <td>호스팅·데이터베이스 사업자가 보안과 운영을 위해 자동 기록</td>
              </tr>
            </tbody>
          </table>
          <p>
            비밀번호는 수집하지 않습니다. 로그인은 이메일로 보내는 일회용 링크로만
            이루어집니다.
          </p>

          <h2>2. 보유 기간</h2>
          <p>
            <span className={styles.todo}>TODO</span> — 회원 탈퇴 시 계정 정보를 언제
            파기할지, 작성한 글과 댓글을 함께 지울지 남길지, 남긴다면 필자 표시를 어떻게
            할지 정해야 합니다. 법령에 별도 보존 의무가 있는 항목이 있는지도 확인하세요.
          </p>

          <h2>3. 처리 위탁 및 국외 이전</h2>
          <p>서비스 운영을 위해 아래 사업자에 개인정보 처리를 위탁합니다.</p>
          <table>
            <thead>
              <tr>
                <th>수탁자</th>
                <th>위탁 업무</th>
                <th>보관 위치</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Supabase</td>
                <td>데이터베이스, 인증, 파일 저장, 인증 메일 발송</td>
                <td>
                  <span className={styles.todo}>TODO</span> — 프로젝트 생성 시 고른 리전
                </td>
              </tr>
              <tr>
                <td>Vercel</td>
                <td>웹사이트 호스팅</td>
                <td>
                  <span className={styles.todo}>TODO</span> — 배포 리전
                </td>
              </tr>
            </tbody>
          </table>
          <p>
            보관 위치가 국외라면 국외 이전에 해당하므로, 이전받는 자·이전 국가·이전
            일시와 방법·이전 항목·보유 기간을 명시해야 합니다.
          </p>

          <h2>4. 이용자의 권리</h2>
          <p>
            이용자는 자신의 개인정보에 대해 열람·정정·삭제·처리정지를 요구할 수 있습니다.
            요구 방법은 아래 연락처로 안내합니다.
          </p>
          <p>
            <span className={styles.todo}>TODO</span> — 마이페이지에서 직접 할 수 있는
            범위(프로필 수정, 탈퇴)와 문의로만 가능한 범위를 구분해 적으세요.
          </p>

          <h2>5. 파기 절차</h2>
          <p>
            <span className={styles.todo}>TODO</span>
          </p>

          <h2>6. 개인정보 보호책임자</h2>
          <p>
            <span className={styles.todo}>TODO</span> — 이름 또는 직책, 연락 가능한
            이메일 주소.
          </p>

          <h2>7. 방침의 변경</h2>
          <p>
            이 방침을 변경할 때는 변경 사항을 {SITE_NAME} 에 공지합니다. 이용자에게
            불리한 변경은 시행 전 충분한 기간을 두고 알립니다.
          </p>
        </div>
      </article>
    </div>
  );
}
