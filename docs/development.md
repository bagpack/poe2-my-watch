# 開発環境

read_when:
- Node.jsのテスト、構文チェック、拡張パッケージ生成を実行するとき
- Dev ContainerやGitHub Actionsの実行環境を変更するとき

このリポジトリの開発用Node.js実行はDev Containerを使用します。ホスト側のNode.jsバージョンやOSのコマンド環境に依存しないよう、開発・検証コマンドはコンテナ内で実行してください。

## 前提

- Docker
- VS Code
- Dev Containers拡張

## Dev Containerを起動する

1. リポジトリをVS Codeで開きます。
2. **Reopen in Container**を選択します。
3. コンテナ内のターミナルを開きます。

設定は`.devcontainer/devcontainer.json`と`.devcontainer/Dockerfile`にあります。Node.js 24と、拡張パッケージ生成に必要な`zip`、`unzip`をコンテナへ用意します。`act`がworkflow実行用のコンテナを起動できるよう、Docker-in-Docker Featureと`--privileged`を使用します。

## GitHub Actionsをローカルで検証する

Dev Containerには次のツールを固定バージョンで用意しています。

- `act v0.2.89`: GitHub Actions workflowをDocker上で実行する
- `actionlint v1.7.12`: workflowの構文と式を静的検査する

まずworkflowの静的検査とジョブ一覧を確認します。

```sh
actionlint
act --list --workflows .github/workflows/ci.yml
```

CI workflowのテストジョブを実行する場合は、次を使います。

```sh
act pull_request --workflows .github/workflows/ci.yml --job test-and-package --platform ubuntu-latest=catthehacker/ubuntu:act-latest
```

Apple Siliconなどホストとrunnerのアーキテクチャが異なる環境では、必要に応じて`--container-architecture linux/arm64`または`linux/amd64`を追加します。

`act`は必ずDev Container内のターミナルから実行します。Dev Container内のDocker daemonを使ってworkflowのrunnerコンテナを起動するため、ホストのDocker socketを共有する設定は不要です。`act`実行用のコンテナとキャッシュはDev Container内に作成されます。

GitHub Actionsでは`devcontainers/ci`でさらにDev Containerを起動しますが、`act`のrunnerコンテナから別のDev Containerを起動すると、runner内の一時ファイルを次のDocker daemonが参照できません。そのため、`act`が設定する`ACT`環境変数でこのstepだけを分岐し、ローカルでは同じtest、syntaxcheck、package処理をrunnerコンテナ内で実行します。GitHub Actions上では従来どおりリポジトリのDev Containerを使います。GitHub artifactへのuploadもローカルでは省略します。

release workflowはGitHub Releaseを作成・更新する副作用があるため、`act`の対象にしません。ローカルで確認する対象は`.github/workflows/ci.yml`だけです。

## 検証コマンド

コンテナ内で次を実行します。

```sh
actionlint
npm test
npm run syntaxcheck
npm run package:extension
```

生成物は`dist/poe2-my-watch-vX.Y.Z.zip`です。

## CIとrelease

GitHub ActionsのCIとrelease workflowも、リポジトリのDev Containerを`devcontainers/ci`で利用して、workflowの静的検査、テスト、構文チェック、拡張パッケージ生成を実行します。release workflowのGitHub Release操作だけはGitHub Actions runner側で実行します。

release workflowは、成果物を作成する`build`ジョブ（`contents: read`）とGitHub Releaseを更新する`release`ジョブ（`contents: write`）に分離しています。workflowで使用する外部ActionはコミットSHAで固定し、更新時は対応するバージョンコメントとSHAを同時に確認します。

## Chromeで確認する

1. `npm run package:extension -- v0.1.0`でZIPを生成します。
2. ZIPを展開します。
3. ChromeまたはChromiumで`chrome://extensions`を開きます。
4. **Developer mode**を有効にします。
5. **Load unpacked**を選び、展開したフォルダー内の`manifest.json`を指定します。

拡張をreloadした場合、既に開いている公式トレードページもreloadして新しいcontent scriptを読み込ませます。
